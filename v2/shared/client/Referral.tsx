export type Contact = { name: string; phone: string; why: string };

/** Numbers to call when the place is outside Oltu; each one is a tap-to-call link. */
export function ContactList({ contacts }: { contacts: Contact[] }) {
  return (
    <ul className="contacts">
      {contacts.map((c) => (
        <li key={c.phone + c.name}>
          <a className="call" href={`tel:${c.phone}`}>
            <strong>{c.name}</strong>
            <span className="num">{c.phone}</span>
          </a>
          <small>{c.why}</small>
        </li>
      ))}
    </ul>
  );
}
