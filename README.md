# ChainBloom Bank Garden

ChainBloom Bank Garden is a Node.js, Express, EJS, Sequelize, and MySQL app. Users can sign up, log in, deposit and withdraw fake garden funds, and spend those funds to care for a virtual collectible plant.

The app also includes a simulated contract layer. It is not a real blockchain contract. Instead, deposits, withdrawals, and plant-care spending create fake contract events and fake transaction hashes so the app can demonstrate how a contract-backed balance would work.

## Requirements

- Node.js
- MySQL Server
- MySQL Workbench, optional but useful
- Git, if cloning the project

## Database Setup

1. Open MySQL Workbench.
2. Connect to your local MySQL server.
3. Create a schema/database named:

```sql
credentials
```

4. Create or use a MySQL user that has access to the `credentials` database.

The app creates and updates the tables automatically with Sequelize, so you do not need to manually create the `users` or `accounts` tables.

## Environment File

Create a `.env` file in the project root:

```bash
touch .env
```

Add these values:

```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_DATABASE=credentials
DB_PORT=3306
DB_DIALECT=mysql
CONTRACT_ADDRESS=0xChainBloomDemoContract
BANK_WALLET_ADDRESS=0xYourReceivingWalletAddress
CARE_WALLET_ADDRESS=0xYourPlantCareReceivingWalletAddress
METAMASK_BUY_URL=https://portfolio.metamask.io/buy
SESSION_SECRET=replace_with_a_long_random_value
HOST=127.0.0.1
PORT=3000
```

`CONTRACT_ADDRESS` is only used for the simulated contract display. You can leave it as the demo value.

`BANK_WALLET_ADDRESS` is the Sepolia Ethereum address that receives MetaMask withdrawals from the app. It must be a real `0x...` wallet address. The app cannot create SepoliaETH in a MetaMask wallet; deposits open the configured funding page, then the app syncs the wallet balance after the wallet changes.

`CARE_WALLET_ADDRESS` receives real SepoliaETH when the user waters, feeds, or gives sunlight to the plant. If it is not set, the app uses `BANK_WALLET_ADDRESS`. For demos, use a second Sepolia wallet you control so the outgoing transfer is easy to show on Sepolia Etherscan.

`METAMASK_BUY_URL` is optional. It controls where the Deposit button sends users when they need to add ETH to MetaMask.

`SESSION_SECRET` signs browser sessions. Use a unique random value for deployments.

`HOST` and `PORT` control where the Express app runs. If you do not set them, the app defaults to `HOST=127.0.0.1` and `PORT=8080`.

## Install Dependencies

From the project folder:

```bash
npm install
```

## Run With Docker

Docker can run both the Express app and MySQL for you. You only need Docker Desktop or a compatible Docker Engine with Docker Compose.

1. Copy the example environment file if you do not already have a local `.env`:

```bash
cp .env.example .env
```

2. Update `.env` if you want different database credentials, port, wallet addresses, or session secret.

3. Build and start the containers:

```bash
docker compose up --build
```

4. Open the app:

```text
http://127.0.0.1:3000
```

The app container uses `HOST=0.0.0.0` internally so it is reachable through Docker's published port. MySQL is available to the app on Docker's internal network as `db:3306`, and its data is stored in the `mysql-data` Docker volume.

To confirm the containers are running:

```bash
docker compose ps
```

To view app logs:

```bash
docker compose logs -f app
```

To stop the app:

```bash
docker compose down
```

To also delete the local Docker database volume:

```bash
docker compose down -v
```

If port `3000` is already in use, change `PORT` in `.env`, then run `docker compose up --build` again.

## How To Run The App

Use these commands from the project folder:

```bash
cd /path/to/COSC-480-website
npm install
npm start
```

For this local copy, the folder is:

```bash
cd /Users/olliea/Downloads/COSC-480-website
npm start
```

If it starts correctly, the terminal should show:

```text
Listening at http://127.0.0.1:3000
Database connection has been established successfully.
```

Open the exact URL shown in your terminal. If your `.env` has `PORT=3000`, open:

```text
http://127.0.0.1:3000
```

Keep the terminal running while using the app. If you close or stop the `npm start` terminal, the browser will show `127.0.0.1 refused to connect`.

Do not open only `http://127.0.0.1` unless the app is running on port `80`. Use the full URL with the port, such as `http://127.0.0.1:3000`.

If you remove `PORT=3000` from `.env`, the app uses the default port:

```text
http://127.0.0.1:8080
```

## How To Test The App

1. Go to the home page.
2. Click or navigate to signup.
3. Create a username and password.
4. Log in with that account.
5. You should land on the bank garden page.

On the bank garden page, you can test:

- Deposit funds
- Withdraw funds
- Connect MetaMask and sync the bank display to your current Sepolia wallet balance
- Water the plant for `0.00003 SepoliaETH`
- Give sunlight for `0.00005 SepoliaETH`
- Feed the plant for `0.00007 SepoliaETH`
- Rename the plant
- Open MetaMask Wallet, or open the MetaMask download page if it is not installed

## What To Look For

The main page shows two important areas.

The **Garden Bank** area shows:

- MetaMask Sepolia Balance
- Deposit form, which opens MetaMask's buy flow
- Withdraw form, which asks MetaMask to send ETH to `BANK_WALLET_ADDRESS`
- Synced Sepolia Wallet Balance
- Contract Status
- Last Contract Action
- Last fake transaction hash
- Contract event count

The **Collectible Plant** area shows:

- Plant emoji
- Plant name
- NFT-style ID
- Growth stage
- Hydration
- Health
- Mood
- Care streak
- Total cares
- Last plant action

## Contract Simulation Behavior

The simulated contract lives in:

```text
contract.service.js
```

Current simulated contract actions:

```text
openAccount()
deposit()
withdraw()
spendForCare()
```

When a user signs up:

```text
Account starts with 25 demo SepoliaETH until MetaMask is connected and synced
Contract event: ContractAccountOpened
```

When a user deposits:

```text
Deposit opens the configured funding flow because a dapp cannot directly add SepoliaETH to a wallet.
After the wallet balance changes, reconnect MetaMask to sync the app/database balance.
```

When a user withdraws:

```text
Withdraw prompts MetaMask for a real Sepolia transaction to `BANK_WALLET_ADDRESS`.
After MetaMask returns a transaction hash, the app syncs the current wallet balance.
```

When a user cares for the plant:

```text
Water, feed, or sunlight sends a small real SepoliaETH transaction from MetaMask before the plant updates
Plant stats update
Contract event: ContractCareSpend
The real Sepolia transaction hash is saved and linked to Sepolia Etherscan
```

## Important Files

```text
app.js
```

Main Express server. Handles routes, sessions, login, signup, balance updates, plant actions, and rendering pages.

```text
login.contr.js
```

Database controller. Defines the Sequelize `user` and `accounts` models and saves account, plant, and contract state.

```text
contract.service.js
```

Simulated contract service. Generates fake contract events and fake transaction hashes for account opening, deposits, withdrawals, and care spending.

```text
views/bank.ejs
```

Main logged-in page. Displays bank controls, plant information, and contract simulation details.

```text
public/bankScript.js
```

Browser-side JavaScript for the bank page. Sends deposit, withdraw, care, and rename requests to the server and updates the page.

```text
views/login2.ejs
views/signup2.ejs
```

Login and signup pages.

## Common Problems

If the app cannot connect to MySQL, check:

- MySQL Server is running.
- `.env` has the correct username and password.
- `DB_DATABASE=credentials` matches the schema name.
- `DB_DIALECT=mysql` is set.

If the app says the port is already being used, stop the other server or change `PORT` in `.env`:

```env
PORT=3001
```

Then run `npm start` again and open the URL shown in the terminal.

If tables do not look current, restart the app. Sequelize runs:

```js
sequelize.sync()
```

which creates missing tables when the app starts and the database methods run.

Do not repeatedly run `sequelize.sync({ alter: true })` on this MySQL database. It can create too many repeated indexes and crash with `Too many keys specified; max 64 keys allowed`.
