import fs from "node:fs/promises";
import timers from "node:timers/promises";
import url from "node:url";
import * as commander from "commander";
import { got } from "got";
import * as Got from "got";
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
      version: string;
      configuration: {
        targets: Got.OptionsOfUnknownResponseBody[];
        email: {
          options: any;
          defaults: nodemailer.SendMailOptions;
        };
        interval: number;
        got: Got.ExtendOptions;
      };
      log(...messageParts: string[]): void;
    } = {
      version,
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

    application.configuration.interval ??= 5 * 60 * 1000;

    const gotClient = got.extend(
      application.configuration.got ?? {
        timeout: {
          request: 5 * 1000,
        },
        retry: {
          limit: 5,
        },
      }
    );

    application.log(
      "MONITOR",
      application.version,
      "STARTING...",
      JSON.stringify(application.configuration.targets)
    );

    const notifiedTargets = new Set<
      typeof application["configuration"]["targets"][number]
    >();

    (async () => {
      while (true) {
        for (const target of application.configuration.targets) {
          application.log("STARTING...", JSON.stringify(target));

          try {
            const response = await gotClient(target);
            notifiedTargets.delete(target);
            application.log(
              "SUCCESS",
              JSON.stringify(target),
              String(response.statusCode),
              JSON.stringify(response.timings)
            );
          } catch (error: any) {
            application.log(
              "ERROR",
              JSON.stringify(target),
              String(error),
              error?.stack
            );
            if (notifiedTargets.has(target))
              application.log(
                "SKIPPING SENDING ALERT BECAUSE PREVIOUS ERROR HASN’T BEEN RESOLVED YET...",
                JSON.stringify(target)
              );
            else {
              try {
                const sentMessageInfo = await sendMailTransport.sendMail({
                  subject: `⚠️ ‘${JSON.stringify(target)}’ IS DOWN`,
                  html: html`
                    <pre>
${String(error)}

${error?.stack}
</pre>
                  `,
                });
                notifiedTargets.add(target);
                application.log(
                  "ALERT SENT",
                  JSON.stringify(target),
                  sentMessageInfo.response ?? ""
                );
              } catch (error: any) {
                application.log(
                  "CATASTROPHIC ERROR TRYING TO SEND ALERT",
                  JSON.stringify(target),
                  String(error),
                  error?.stack
                );
              }
            }
          }

          application.log("FINISHED", JSON.stringify(target));
        }

        await timers.setTimeout(application.configuration.interval, undefined, {
          ref: false,
        });
      }
    })();

    await stop;

    process.once("exit", () => {
      application.log("STOPPED");
    });

    await timers.setTimeout(10 * 1000, undefined, { ref: false });
    process.exit(1);
  })
  .parseAsync();
