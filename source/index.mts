import fs from "node:fs/promises";
import timers from "node:timers/promises";
import url from "node:url";
import * as commander from "commander";
import { got } from "got";
import nodemailer from "nodemailer";
import { html } from "@leafac/html";

const version = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8")
).version;

await commander.program
  .name("monitor")
  .description("Radically Straightforward Monitoring")
  .argument("<configuration>", "Path to configuration file.")
  .version(version)
  .allowExcessArguments(false)
  .showHelpAfterError()
  .action(async (configuration: string) => {
    const stop = new Promise<void>((resolve) => {
      const processKeepAlive = new AbortController();
      timers
        .setInterval(1 << 30, undefined, {
          signal: processKeepAlive.signal,
        })
        [Symbol.asyncIterator]()
        .next()
        .catch(() => {});
      for (const event of [
        "exit",
        "SIGHUP",
        "SIGINT",
        "SIGQUIT",
        "SIGTERM",
        "SIGUSR2",
        "SIGBREAK",
      ])
        process.on(event, () => {
          processKeepAlive.abort();
          resolve();
        });
    });

    const application: {
      configuration: {
        urls: string[];
        email: {
          options: any;
          defaults: nodemailer.SendMailOptions;
        };
      };
      log(...messageParts: string[]): void;
    } = {
      configuration: (await import(url.pathToFileURL(configuration).href))
        .default,
      log(...messageParts) {
        console.log([new Date().toISOString(), ...messageParts].join(" \t"));
      },
    };

    const sendMailTransport = nodemailer.createTransport(
      application.configuration.email.options,
      application.configuration.email.defaults
    );

    application.log("STARTING...", application.configuration.urls.join(", "));

    const notifiedURLs = new Set<string>();

    (async () => {
      while (true) {
        for (const url of application.configuration.urls) {
          application.log("STARTING...", url);

          try {
            const response = await got(url);
            notifiedURLs.delete(url);
            application.log("SUCCESS", url, String(response.statusCode));
          } catch (error: any) {
            application.log("ERROR", url, String(error), error?.stack);
            if (notifiedURLs.has(url))
              application.log(
                "SKIPPING SENDING ALERT BECAUSE PREVIOUS ERROR HASN’T BEEN RESOLVED YET...",
                url
              );
            else {
              notifiedURLs.add(url);
              try {
                const sentMessageInfo = await sendMailTransport.sendMail({
                  subject: `‘${url}’ IS DOWN`,
                  html: html`
                    <pre>
                    ${String(error)}

                    ${error?.stack}
                  </pre
                    >
                  `,
                });
                application.log(
                  "ALERT SENT",
                  url,
                  sentMessageInfo.response ?? ""
                );
              } catch (error: any) {
                application.log(
                  "CATASTROPHIC ERROR TRYING TO SEND ALERT",
                  url,
                  String(error),
                  error?.stack
                );
              }
            }
          }

          application.log("FINISHED", url);
        }

        await timers.setTimeout(
          5 * 60 * 1000 + Math.random() * 30 * 1000,
          undefined,
          { ref: false }
        );
      }
    })();

    await stop;

    application.log("FINISHED");

    await timers.setTimeout(10 * 1000, undefined, { ref: false });
    process.exit(1);
  })
  .parseAsync();
