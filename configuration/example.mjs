export default {
  // The targets to monitor. See ‘https://github.com/sindresorhus/got/blob/main/documentation/2-options.md’.
  targets: [
    { url: "https://example.com" },
    // ...
  ],

  // Configuration for the email server. See ‘https://nodemailer.com/smtp/’.
  email: {
    options: {
      host: "smtp.example.com",
      auth: {
        user: "username",
        pass: "password",
      },
    },
    defaults: {
      from: "Monitor <monitor@example.com>",
      to: "System Administrator <system-administrator@example.com>",
    },
  },

  // [OPTIONAL] The interval between checks.
  // interval: 5 * 60 * 1000,

  // [OPTIONAL] Extra Got instance configuration. See ‘https://github.com/sindresorhus/got/tree/main/documentation’.
  // got: {
  //   timeout: {
  //     request: 5000,
  //   },
  //   retry: {
  //     limit: 5,
  //   },
  // },
};
