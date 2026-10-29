import { StaffConsole } from "./_components/StaffConsole";

/* /staff: the office team's live alert queue. Everything on it depends on the
 * admin token in localStorage, so the page itself is a client component. */
export default function StaffPage() {
  return <StaffConsole />;
}
