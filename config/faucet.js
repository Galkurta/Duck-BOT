const fs = require("fs");
const path = require("path");
const axios = require("axios");
const logger = require("./logger");
const colors = require("./colors");

class DuckChainFaucet {
  constructor() {
    this.headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US;q=0.6,en;q=0.5",
      Origin: "https://testnet-faucet.duckchain.io",
      Referer: "https://testnet-faucet.duckchain.io/",
      "Sec-Ch-Ua":
        '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Ch-Ua-Platform": '"Android"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
    };
  }

  maskWalletAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 6)}****${address.slice(-4)}`;
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
      // Move cursor back to start of time
      process.stdout.write("\x1B[" + formatTime(i).length + "D");
    }

    // Clear the countdown line and move cursor to start
    process.stdout.write("\x1B[2K\x1B[0G");
    process.stdout.write("\x1B[?25h"); // Show cursor
  }

  async makeRequest(url, options = {}) {
    try {
      const response = await axios({
        method: "get",
        url,
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });
      return { success: true, data: response.data };
    } catch (error) {
      logger.error(
        `${colors.error}Request failed: ${error.message}${colors.reset}`
      );
      return { success: false, error: error.message };
    }
  }

  async claimFaucet(authorization, address) {
    try {
      logger.info(
        `${colors.faucetInfo}Attempting to claim faucet for address: ${
          colors.accountInfo
        }${this.maskWalletAddress(address)}${colors.reset}`
      );

      const result = await this.makeRequest(
        `https://testnet-faucet-api.duckchain.io/api/duckchain/claim_faucet?address=${address}`,
        {
          headers: {
            Authorization: authorization,
          },
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const { data } = result;

      if (data.describe === "Token Claim successfully.") {
        logger.success(
          `${colors.faucetSuccess}Token claim successful${colors.reset}`
        );
        return { success: true, data };
      } else if (data.describe === "You have already claimed token today.") {
        logger.warn(
          `${colors.faucetWait}Already claimed today - try again tomorrow${colors.reset}`
        );
        return {
          success: false,
          needWait: true,
          ttl: data.ttl,
          message: data.describe,
        };
      } else {
        logger.error(
          `${colors.faucetError}Claim failed: ${data.describe}${colors.reset}`
        );
        return {
          success: false,
          error: data.describe,
        };
      }
    } catch (error) {
      logger.error(
        `${colors.faucetError}Faucet claim error: ${error.message}${colors.reset}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async validateFiles() {
    try {
      const dataFile = path.join(__dirname, "..", "token.txt");
      const walletFile = path.join(__dirname, "..", "wallet.txt");

      // Check if files exist
      if (!fs.existsSync(dataFile)) {
        throw new Error("token.txt file not found");
      }
      if (!fs.existsSync(walletFile)) {
        throw new Error("wallet.txt file not found");
      }

      // Read and validate file contents
      const authorizations = fs
        .readFileSync(dataFile, "utf8")
        .replace(/\r/g, "")
        .split("\n")
        .filter(Boolean);

      const wallets = fs
        .readFileSync(walletFile, "utf8")
        .replace(/\r/g, "")
        .split("\n")
        .filter(Boolean);

      if (authorizations.length === 0) {
        throw new Error("token.txt is empty");
      }
      if (wallets.length === 0) {
        throw new Error("wallet.txt is empty");
      }
      if (authorizations.length !== wallets.length) {
        throw new Error("Number of authorizations and wallets do not match");
      }

      return { authorizations, wallets };
    } catch (error) {
      logger.error(
        `${colors.error}File validation error: ${error.message}${colors.reset}`
      );
      process.exit(1);
    }
  }

  async processAccount(authorization, wallet, index) {
    try {
      logger.info(
        `${colors.accountInfo}Processing Account ${index + 1}${colors.reset}`
      );
      logger.info(
        `${colors.faucetInfo}Wallet address: ${
          colors.accountInfo
        }${this.maskWalletAddress(wallet)}${colors.reset}`
      );

      const result = await this.claimFaucet(authorization, wallet);

      if (!result.success) {
        if (result.needWait) {
          await this.countdown(result.ttl);
        } else {
          logger.error(
            `${colors.faucetError}Failed to process account: ${result.error}${colors.reset}`
          );
        }
      }

      // Wait between accounts
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error(
        `${colors.error}Account processing error: ${error.message}${colors.reset}`
      );
    }
  }

  async main() {
    try {
      logger.info(
        `${colors.faucetInfo}Starting DuckChain Faucet Bot${colors.reset}`
      );

      // Validate and get file contents
      const { authorizations, wallets } = await this.validateFiles();

      while (true) {
        logger.info(
          `${colors.faucetInfo}Beginning new claim cycle${colors.reset}`
        );

        // Process each account
        for (let i = 0; i < authorizations.length; i++) {
          await this.processAccount(authorizations[i], wallets[i], i);
        }

        // Wait for next cycle
        logger.info(
          `${colors.faucetInfo}Claim cycle completed. Waiting for next cycle...${colors.reset}`
        );
        await this.countdown(86400); // Wait 24 hours
      }
    } catch (error) {
      logger.error(
        `${colors.error}Fatal error: ${error.message}${colors.reset}`
      );
      process.exit(1);
    }
  }
}

module.exports = DuckChainFaucet;
