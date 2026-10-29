import { StaffConsole } from "./_components/StaffConsole";

/* /staff: the office team's live views. They poll the API from the browser,
 * so the console itself is a client component. */
export default function StaffPage() {
  return <StaffConsole />;
}
