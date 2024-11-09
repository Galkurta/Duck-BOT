const fs = require("fs");
const path = require("path");
const axios = require("axios");
const inquirer = require("inquirer").default;
const displayBanner = require("./config/banner");
const logger = require("./config/logger");
const colors = require("./config/colors");
const DuckChainFaucet = require("./config/faucet");

class DuckChainBot {
  constructor() {
    this.headers = {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US;q=0.6,en;q=0.5",
      Origin: "https://tgdapp.duckchain.io",
      Referer: "https://tgdapp.duckchain.io/",
      "Sec-Ch-Ua":
        '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    };
  }

  async countdown(seconds) {
    process.stdout.write("\x1B[?25l"); // Hide cursor

    const formatTime = (timeInSeconds) => {
      const hours = Math.floor(timeInSeconds / 3600);
      const minutes = Math.floor((timeInSeconds % 3600) / 60);
      const seconds = timeInSeconds % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    const message = `${colors.timerCount}Waiting to continue... Time remaining: `;
    process.stdout.write(message);

    for (let i = seconds; i > 0; i--) {
      process.stdout.write(
        `${colors.timerWarn}${formatTime(i)}${colors.reset}`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      process.stdout.write("\x1B[" + formatTime(i).length + "D");
    }

    process.stdout.write("\x1B[2K\x1B[0G");
    process.stdout.write("\x1B[?25h"); // Show cursor
  }

  // API methods
  async makeRequest(url, authorization) {
    try {
      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getUserInfo(authorization) {
    return this.makeRequest(
      "https://preapi.duckchain.io/user/info",
      authorization
    );
  }

  async setDuckName(authorization, duckName) {
    return this.makeRequest(
      `https://preapi.duckchain.io/user/set_duck_name?duckName=${encodeURIComponent(
        duckName
      )}`,
      authorization
    );
  }

  async collectDailyEgg(authorization) {
    try {
      const checkResponse = await this.makeRequest(
        "https://preapi.duckchain.io/property/daily/isfinish?taskId=1",
        authorization
      );

      if (!checkResponse.success) {
        return checkResponse;
      }

      if (checkResponse.data.code === 200) {
        if (checkResponse.data.data === 0) {
          const collectResponse = await this.makeRequest(
            "https://preapi.duckchain.io/property/daily/finish?taskId=1",
            authorization
          );

          if (
            collectResponse.success &&
            collectResponse.data.code === 200 &&
            collectResponse.data.data === true
          ) {
            logger.success(
              `${colors.taskComplete}Daily egg collection successful${colors.reset}`
            );
            return { success: true, data: collectResponse.data.data };
          } else {
            return { success: false, error: collectResponse.data.message };
          }
        } else {
          logger.warn(
            `${colors.warning}Daily egg already collected${colors.reset}`
          );
          return { success: false, error: "Already collected today" };
        }
      } else {
        return { success: false, error: checkResponse.data.message };
      }
    } catch (error) {
      logger.error(
        `${colors.error}Error collecting daily egg: ${error.message}${colors.reset}`
      );
      return { success: false, error: error.message };
    }
  }

  // Task methods
  async performDailyCheckIn(authorization) {
    const result = await this.makeRequest(
      "https://preapi.duckchain.io/task/sign_in",
      authorization
    );
    if (result.success && result.data.code === 200) {
      logger.success(
        `${colors.taskComplete}Daily check-in successful${colors.reset}`
      );
    }
    return result;
  }

  async getTaskList(authorization) {
    return this.makeRequest(
      "https://preapi.duckchain.io/task/task_list",
      authorization
    );
  }

  async getTaskInfo(authorization) {
    return this.makeRequest(
      "https://preapi.duckchain.io/task/task_info",
      authorization
    );
  }

  async completeTask(authorization, task) {
    const result = await this.makeRequest(
      `https://preapi.duckchain.io/task/onetime?taskId=${task.taskId}`,
      authorization
    );
    if (result.success && result.data.code === 200) {
      logger.success(
        `${colors.taskComplete}Task ${task.content} completed | Reward: ${colors.brightYellow}${task.integral} DUCK${colors.reset}`
      );
    }
    return result;
  }

  // Task processing
  async processAllTasks(authorization) {
    try {
      logger.info(
        `${colors.taskInProgress}Checking daily egg collection...${colors.reset}`
      );
      await this.collectDailyEgg(authorization);

      const taskInfo = await this.getTaskInfo(authorization);
      if (!taskInfo.success) {
        logger.error(
          `${colors.error}Could not get task info: ${taskInfo.error}${colors.reset}`
        );
        return;
      }

      const taskList = await this.getTaskList(authorization);
      if (!taskList.success) {
        logger.error(
          `${colors.error}Could not get task list: ${taskList.error}${colors.reset}`
        );
        return;
      }

      const { daily, oneTime, partner } = taskList.data.data;
      const completed = taskInfo.data.data;

      // Process daily tasks
      if (daily?.length) {
        for (const task of daily) {
          if (task.taskId === 8 && !completed.daily.includes(8)) {
            logger.info(
              `${colors.taskInProgress}Processing daily check-in...${colors.reset}`
            );
            await this.performDailyCheckIn(authorization);
          }
        }
      }

      // Process one-time tasks
      if (oneTime?.length) {
        for (const task of oneTime) {
          if (!completed.oneTime.includes(task.taskId)) {
            logger.info(
              `${colors.taskInProgress}Processing task: ${task.content}...${colors.reset}`
            );
            await this.completeTask(authorization, task);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      // Process partner tasks
      if (partner?.length) {
        for (const task of partner) {
          if (!completed.partner.includes(task.taskId)) {
            logger.info(
              `${colors.taskInProgress}Processing partner task: ${task.content}...${colors.reset}`
            );
            await this.completeTask(authorization, task);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      logger.success(
        `${colors.taskComplete}All tasks processed successfully${colors.reset}`
      );
    } catch (error) {
      logger.error(
        `${colors.error}Error processing tasks: ${error.message}${colors.reset}`
      );
    }
  }

  async main() {
    const dataFile = path.join(__dirname, "data.txt");
    const data = fs
      .readFileSync(dataFile, "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .filter(Boolean);

    while (true) {
      for (const authorization of data) {
        const userData = JSON.parse(
          decodeURIComponent(authorization.split("user=")[1].split("&")[0])
        );
        const fullName = `${userData.first_name} ${
          userData.last_name || ""
        }`.trim();

        logger.info(
          `${colors.accountName}Processing Account: ${fullName}${colors.reset}`
        );

        const userInfo = await this.getUserInfo(authorization);
        if (userInfo.success) {
          if (!userInfo.data.data.duckName) {
            logger.info(
              `${colors.accountInfo}Setting up duck name...${colors.reset}`
            );
            const setNameResult = await this.setDuckName(
              authorization,
              fullName
            );
            if (setNameResult.success) {
              logger.success(
                `${colors.taskComplete}Duck name set successfully${colors.reset}`
              );
            } else {
              logger.error(
                `${colors.error}Failed to set duck name${colors.reset}`
              );
            }
          }

          logger.info(
            `${colors.taskInProgress}Processing tasks...${colors.reset}`
          );
          await this.processAllTasks(authorization);
        } else {
          logger.error(
            `${colors.error}Failed to get account info: ${userInfo.error}${colors.reset}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      logger.info(
        `${colors.taskComplete}All accounts processed. Starting next cycle.${colors.reset}`
      );
      await this.countdown(86400); // 24 hours
    }
  }
}

async function main() {
  displayBanner();

  try {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: `${colors.menuTitle}Select an action:${colors.reset}`,
        choices: [
          { name: `${colors.menuOption}Run Bot${colors.reset}`, value: "bot" },
          {
            name: `${colors.menuOption}Claim Faucet${colors.reset}`,
            value: "faucet",
          },
        ],
      },
    ]);

    if (action === "bot") {
      const bot = new DuckChainBot();
      await bot.main();
    } else {
      const faucet = new DuckChainFaucet();
      await faucet.main();
    }
  } catch (error) {
    logger.error(
      `${colors.error}Application Error: ${error.message}${colors.reset}`
    );
    process.exit(1);
  }
}

// Error handling
process.on("uncaughtException", (err) => {
  logger.error(
    `${colors.error}Uncaught Exception: ${err.message}${colors.reset}`
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `${colors.error}Unhandled Rejection at: ${promise}, reason: ${reason}${colors.reset}`
  );
  process.exit(1);
});

// Start the application
main().catch((err) => {
  logger.error(
    `${colors.error}Application Error: ${err.message}${colors.reset}`
  );
  process.exit(1);
});

module.exports = {
  DuckChainBot,
  DuckChainFaucet,
};
