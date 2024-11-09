# DuckChain Bot

An automated bot for DuckChain tasks and faucet claiming.

## Features

- Auto daily tasks completion
- Auto daily egg collection
- Auto faucet claiming
- Task reward collection
- Multi-account support
- Clean console interface
- Detailed logging

## Prerequisites

- Node.js (version 14 or higher)
- NPM (Node Package Manager)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Galkurta/Duck-BOT.git
cd Duck-BOT
```

2. Install dependencies:

```bash
npm install
```

3. Create required files:

   - `auth.txt` - For faucet authorization
   - `wallet.txt` - For wallet addresses

4. Edit `data.txt` bot authorization

```
query_id=
query_id=
```

## Configuration

### Setting up authorization files

1. Register on [DuckChain](https://t.me/DuckChain_bot/quack?startapp=vU81rJH9) and start the bot.

2. Getting Bot Authorization:

- Open DuckChain bot
- Click Home > Faucet
- Open browser Developer Tools (F12)
- Go to Network tab
- Click "Send me ton" button
- Look for `claim_faucet` request
- Copy `Authorization` value from request headers
- Paste into `token.txt` (one authorization per line)

3. Getting Wallet Addresses:

- Create `wallet.txt`
- Add your wallet addresses (one per line)
- Make sure each address corresponds to the authorization in `token.txt`

### File Structure Example:

```plaintext
auth.txt
data.txt
wallet.txt
```

## Usage

Run the bot:

```bash
node main.js
```

Select your desired action:

1. Run Bot - Completes daily tasks and collects eggs
2. Claim Faucet - Claims daily faucet tokens

## Features Detail

### Bot Mode

- Automatically sets duck name if not set
- Collects daily eggs
- Performs daily check-in
- Completes available tasks
- Collects task rewards
- Runs on a 24-hour cycle

### Faucet Mode

- Claims daily faucet tokens
- Supports multiple wallets
- Shows claim status
- Automatic retries after 24 hours

## Console Output

The bot provides detailed console output with:

- Task completion status
- Reward information
- Error messages
- Countdown timers
- Account processing status

## Error Handling

The bot includes comprehensive error handling for:

- Network issues
- Invalid authorizations
- Failed tasks
- API limitations

## Important Notes

1. Keep your authorization tokens secure
2. Don't share your `token.txt` and `wallet.txt` files
3. Make sure the number of authorizations matches the number of wallets
4. The bot runs continuously until manually stopped

## Contributing

Feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License.

## Disclaimer

This bot is for educational purposes only. Use at your own risk. Author is not responsible for any potential account restrictions or losses.
