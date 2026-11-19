model PersonProfile {
  id: string;
  name: string;
  role: string;
  description?: string;
  initials: string;
  photoUrl?: string;
}

model PeopleDirectory {
  schemaVersion: "canonical-cloud.people/v1";
  people: PersonProfile[];
}
