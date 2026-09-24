export const clients = [
  {
    id: "refrigo",
    logo: {
      src: "/clients/refrigo/logotipo.png",
      width: 200,
      height: 71,
    },
    theme: {
      primary: "#E82020",
      primaryHover: "#c81a1a",
      primaryLight: "#fee2e2",
      secondary: "#1A1A6B",
      secondaryLight: "#eef2ff",
    },
  },
] as const;

export type ClientId = (typeof clients)[number]["id"];

export type ClientEntry = (typeof clients)[number];

export function getClient(id: string): ClientEntry | undefined {
  return clients.find((c) => c.id === id);
}
