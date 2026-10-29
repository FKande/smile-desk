import { PatientChat } from "./_chat/PatientChat";

/* The patient chat. Everything on it is client state (the thread lives in
 * the API, the conversation id in localStorage), so the page is a shell. */
export default function Home() {
  return <PatientChat />;
}
