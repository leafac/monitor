export default {
  urls: ["https://leafac.com"],
  email: {
    options: { streamTransport: true, buffer: true },
    defaults: {
      from: "Monitor <monitor@leafac.com>",
      to: "Leandro Facchinetti <system-administrator@leafac.com>",
    },
  },
};
