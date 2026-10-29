import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '../common/clock.js';
import { NotFoundError } from '../common/errors.js';
import { toUtcIso } from '../common/time.js';
import { DB, type Db } from '../database/database.js';
import { PRACTICE } from '../practice/practice.js';
import {
  isMinor,
  normalizeDateOfBirth,
  normalizeInsurance,
  normalizeName,
  normalizePhone,
} from './patient-input.js';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  insuranceName: string | null;
  householdId: string | null;
  guardianId: string | null;
}

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  insurance_name: string | null;
  household_id: string | null;
  guardian_id: string | null;
}

const toPatient = (r: PatientRow): Patient => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  dateOfBirth: r.date_of_birth,
  phone: r.phone,
  insuranceName: r.insurance_name,
  householdId: r.household_id,
  guardianId: r.guardian_id,
});

export interface IdentityClaim {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone?: string;
}

// "not_found" also covers wrong DOB/phone so the bot never reveals that a record exists.
export type VerificationResult =
  | { status: 'verified'; patient: Patient }
  | { status: 'needs_phone' }
  | { status: 'not_found' };

export interface NewPatient {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  insuranceName?: string | null;
}

@Injectable()
export class PatientsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  findById(id: string): Patient | null {
    const row = this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined;
    return row ? toPatient(row) : null;
  }

  getById(id: string): Patient {
    const patient = this.findById(id);
    if (!patient) throw new NotFoundError('Patient', id);
    return patient;
  }

  /** Name + date of birth are required; phone breaks ties and must match if given. */
  verifyIdentity(claim: IdentityClaim): VerificationResult {
    const firstName = normalizeName(claim.firstName, 'First name');
    const lastName = normalizeName(claim.lastName, 'Last name');
    const dateOfBirth = normalizeDateOfBirth(claim.dateOfBirth, this.clock.now());
    const phone = claim.phone ? normalizePhone(claim.phone) : undefined;

    const candidates = (
      this.db
        .prepare(
          `SELECT * FROM patients
           WHERE location_id = ? AND last_name = ? COLLATE NOCASE
             AND first_name = ? COLLATE NOCASE AND date_of_birth = ?`,
        )
        .all(PRACTICE.locationId, lastName, firstName, dateOfBirth) as PatientRow[]
    ).map(toPatient);

    const matches = phone ? candidates.filter((p) => p.phone === phone) : candidates;
    if (matches.length === 1) return { status: 'verified', patient: matches[0] };
    if (matches.length > 1) return { status: 'needs_phone' };
    return { status: 'not_found' };
  }

  /** Registers a new patient, or returns the existing record for the same person. */
  register(input: NewPatient): { patient: Patient; alreadyExisted: boolean } {
    return this.insert(input, { householdId: null, guardianId: null });
  }

  /** Adds a spouse or child to the account holder's household, creating it if needed. */
  addFamilyMember(
    accountHolderId: string,
    input: Omit<NewPatient, 'phone'> & { phone?: string },
  ): { patient: Patient; alreadyExisted: boolean } {
    const holder = this.getById(accountHolderId);
    return this.db.transaction(() => {
      let householdId = holder.householdId;
      if (!householdId) {
        householdId = `hh_${randomUUID()}`;
        this.db.prepare('INSERT INTO households (id, name) VALUES (?, ?)').run(householdId, `${holder.lastName} family`);
        this.db.prepare('UPDATE patients SET household_id = ? WHERE id = ?').run(householdId, holder.id);
      }
      const dob = normalizeDateOfBirth(input.dateOfBirth, this.clock.now());
      return this.insert(
        {
          ...input,
          phone: input.phone ?? holder.phone,
          insuranceName: input.insuranceName === undefined ? holder.insuranceName : input.insuranceName,
        },
        { householdId, guardianId: isMinor(dob, this.clock.now()) ? holder.id : null },
      );
    })();
  }

  /** Everyone in the patient's household except the patient. */
  familyMembers(patientId: string): Patient[] {
    const patient = this.getById(patientId);
    if (!patient.householdId) return [];
    return (
      this.db
        .prepare('SELECT * FROM patients WHERE household_id = ? AND id != ? ORDER BY date_of_birth')
        .all(patient.householdId, patient.id) as PatientRow[]
    ).map(toPatient);
  }

  /** A patient can act for themselves, their minors, and members of their household. */
  canActFor(actorId: string, patientId: string): boolean {
    if (actorId === patientId) return true;
    const actor = this.findById(actorId);
    const patient = this.findById(patientId);
    if (!actor || !patient) return false;
    return patient.guardianId === actor.id || (!!actor.householdId && actor.householdId === patient.householdId);
  }

  private insert(
    input: NewPatient,
    links: { householdId: string | null; guardianId: string | null },
  ): { patient: Patient; alreadyExisted: boolean } {
    const firstName = normalizeName(input.firstName, 'First name');
    const lastName = normalizeName(input.lastName, 'Last name');
    const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth, this.clock.now());
    const phone = normalizePhone(input.phone);
    const insuranceName = normalizeInsurance(input.insuranceName);

    const existing = this.db
      .prepare(
        `SELECT * FROM patients WHERE location_id = ? AND last_name = ? COLLATE NOCASE
           AND first_name = ? COLLATE NOCASE AND date_of_birth = ?`,
      )
      .get(PRACTICE.locationId, lastName, firstName, dateOfBirth) as PatientRow | undefined;
    if (existing) return { patient: toPatient(existing), alreadyExisted: true };

    const id = `pat_${randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO patients (id, location_id, first_name, last_name, date_of_birth, phone,
           insurance_name, household_id, guardian_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, PRACTICE.locationId, firstName, lastName, dateOfBirth, phone, insuranceName,
        links.householdId, links.guardianId, toUtcIso(this.clock.now()));
    return { patient: this.getById(id), alreadyExisted: false };
  }
}
