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
    } = {
      configuration: (await import(url.pathToFileURL(configuration).href))
        .default,
    };

    const sendMailTransport = nodemailer.createTransport(
      application.configuration.email.options,
      application.configuration.email.defaults
    );

    (async () => {
      while (true) {
        for (const url of application.configuration.urls) {
          try {
            const response = await got(url);
            console.log(
              `${new Date().toISOString()}\tSUCCESS\t${url}\t${
                response.statusCode
              }`
            );
          } catch (error: any) {
            console.log(
              `${new Date().toISOString()}\tERROR\t${url}\t${String(error)}\t${
                error?.stack
              }`
            );
            try {
              await sendMailTransport.sendMail({
                subject: `‘${url}’ IS DOWN`,
                html: html`
                  <pre>
                    ${String(error)}

                    ${error?.stack}
                  </pre
                  >
                `,
              });
            } catch (error: any) {
              console.log(
                `${new Date().toISOString()}\tCATASTROPHIC ERROR TRYING TO SEND ALERT\t${url}\t${String(
                  error
                )}\t${error?.stack}`
              );
            }
          }
        }
        await timers.setTimeout(5 * 60 * 1000, undefined, { ref: false });
      }
    })();

    await stop;

    await timers.setTimeout(10 * 1000, undefined, { ref: false });
    process.exit(1);
  })
  .parseAsync();
