import { ValidationError } from '../common/errors.js';
import { createTestContext, type TestContext } from '../testing/test-context.js';

describe('PatientsService', () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });

  describe('verifyIdentity', () => {
    it('verifies with name and date of birth, ignoring case and spacing', () => {
      const result = ctx.patients.verifyIdentity({ firstName: ' sarah ', lastName: 'JOHNSON', dateOfBirth: '1988-04-12' });
      expect(result).toMatchObject({ status: 'verified', patient: { id: 'pat_sarah_johnson' } });
    });

    it('tells two people with the same name apart by date of birth', () => {
      const older = ctx.patients.verifyIdentity({ firstName: 'David', lastName: 'Chen', dateOfBirth: '1975-11-30' });
      const younger = ctx.patients.verifyIdentity({ firstName: 'David', lastName: 'Chen', dateOfBirth: '1992-03-14' });
      expect(older).toMatchObject({ patient: { id: 'pat_david_chen_1975' } });
      expect(younger).toMatchObject({ patient: { id: 'pat_david_chen_1992' } });
    });

    it('treats a wrong date of birth or phone exactly like an unknown patient', () => {
      expect(ctx.patients.verifyIdentity({ firstName: 'Sarah', lastName: 'Johnson', dateOfBirth: '1988-04-13' })).toEqual({ status: 'not_found' });
      expect(
        ctx.patients.verifyIdentity({ firstName: 'Sarah', lastName: 'Johnson', dateOfBirth: '1988-04-12', phone: '415-555-9999' }),
      ).toEqual({ status: 'not_found' });
      expect(
        ctx.patients.verifyIdentity({ firstName: 'Sarah', lastName: 'Johnson', dateOfBirth: '1988-04-12', phone: '+1 (415) 555-0142' }),
      ).toMatchObject({ status: 'verified' });
    });
  });

  describe('register', () => {
    const base = { firstName: 'Jordan', lastName: 'Rivera', dateOfBirth: '1990-08-15', phone: '(415) 555-0188', insuranceName: 'Guardian' };

    it('registers a new patient with normalized fields', () => {
      const { patient, alreadyExisted } = ctx.patients.register(base);
      expect(alreadyExisted).toBe(false);
      expect(patient).toMatchObject({ firstName: 'Jordan', phone: '4155550188', insuranceName: 'Guardian' });
    });

    it('returns the existing record instead of creating a duplicate', () => {
      const first = ctx.patients.register(base);
      const again = ctx.patients.register({ ...base, firstName: 'jordan' });
      expect(again).toMatchObject({ alreadyExisted: true, patient: { id: first.patient.id } });
    });

    it.each(['none', 'No insurance', 'self-pay', '', null])('stores "%s" as self-pay', (insuranceName) => {
      expect(ctx.patients.register({ ...base, insuranceName }).patient.insuranceName).toBeNull();
    });

    it.each([
      { phone: '555-0188' },
      { dateOfBirth: '2099-01-01' },
      { dateOfBirth: '15/08/1990' },
      { firstName: '1234' },
    ])('rejects invalid input %o', (override) => {
      expect(() => ctx.patients.register({ ...base, ...override })).toThrow(ValidationError);
    });
  });

  describe('family', () => {
    it('lists household members and adds a child with the parent as guardian', () => {
      expect(ctx.patients.familyMembers('pat_sarah_johnson').map((p) => p.firstName)).toEqual(['Michael', 'Emma', 'Liam']);

      const { patient: kid } = ctx.patients.addFamilyMember('pat_maria_garcia', {
        firstName: 'Sofia',
        lastName: 'Garcia',
        dateOfBirth: '2020-05-01',
      });
      expect(kid).toMatchObject({ guardianId: 'pat_maria_garcia', phone: '4155550199', insuranceName: null });
      expect(ctx.patients.familyMembers('pat_maria_garcia').map((p) => p.id)).toEqual([kid.id]);
      expect(ctx.patients.canActFor('pat_maria_garcia', kid.id)).toBe(true);
      expect(ctx.patients.canActFor('pat_sarah_johnson', kid.id)).toBe(false);
    });

    it('lets adults act for their household, but not children for their parents', () => {
      expect(ctx.patients.canActFor('pat_michael_johnson', 'pat_sarah_johnson')).toBe(true); // spouse
      expect(ctx.patients.canActFor('pat_michael_johnson', 'pat_emma_johnson')).toBe(true); // parent, not the listed guardian
      expect(ctx.patients.canActFor('pat_emma_johnson', 'pat_sarah_johnson')).toBe(false); // child → parent
      expect(ctx.patients.canActFor('pat_emma_johnson', 'pat_liam_johnson')).toBe(false); // child → sibling
    });
  });
});
