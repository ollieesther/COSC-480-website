const bcrypt = require('bcryptjs');
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const path = require('path');
const Database = require('./login.contr');
const contractService = require('./contract.service');

const app = express();
const database = new Database();
const port = process.env.PORT || 8080;
const host = process.env.HOST || '127.0.0.1';
const oneDay = 1000 * 60 * 60 * 24;

function walletConfig() {
    const defaultCareWalletAddress = '0x000000000000000000000000000000000000dEaD';
    return {
        bankWalletAddress: process.env.BANK_WALLET_ADDRESS || '',
        careWalletAddress: process.env.CARE_WALLET_ADDRESS || process.env.BANK_WALLET_ADDRESS || defaultCareWalletAddress,
        buyUrl: process.env.METAMASK_BUY_URL || 'https://portfolio.metamask.io/buy',
        requiredChainId: '0xaa36a7',
        requiredChainName: 'Sepolia',
        explorerBaseUrl: 'https://sepolia.etherscan.io',
        careCosts: { water: 0.00003, sunlight: 0.00005, feed: 0.00007 }
    };
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessions({
    secret: process.env.SESSION_SECRET || 'chainbloom-dev-secret',
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false
}));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

function plantEmoji(stage, health) {
    if (health <= 30) return '🥀';
    if (stage >= 5) return '🌳';
    if (stage >= 4) return '🌺';
    if (stage >= 3) return '🪴';
    if (stage >= 2) return '🌿';
    return '🌱';
}

function moodLabel(health) {
    if (health >= 85) return 'Thriving';
    if (health >= 65) return 'Happy';
    if (health >= 45) return 'Stable';
    if (health >= 25) return 'Droopy';
    return 'Critical';
}

function decoratePlant(plant) {
    return {
        ...plant,
        emoji: plantEmoji(plant.growthStage, plant.health),
        moodLabel: moodLabel(plant.health)
    };
}

function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

async function refreshSessionState(req) {
    const session = req.session;
    const account = await database.getAccount(session.userid);
    if (!account.detected) {
        throw new Error('Account not found');
    }
    session.savings = account.savings;
    session.plant = decoratePlant(account.plant);
    session.contract = account.contract;
    return session;
}

app.get('/', asyncRoute(async (req, res) => {
    if (req.session.userid) {
        await refreshSessionState(req);
        return res.redirect('/bank');
    }
    res.render('index');
}));

app.get('/login', (req, res) => res.render('login2'));
app.get('/signup', (req, res) => res.render('signup2'));

app.post('/loginUser', asyncRoute(async (req, res) => {
    const { username, password } = req.body;
    const user = await database.findUser(username);

    if (!user.detected) {
        return res.status(404).send('User not found');
    }

    const creds = await database.select(username);
    if (!(await bcrypt.compare(password, creds.password))) {
        return res.status(403).send('Invalid password');
    }

    const account = await database.getAccount(creds.userid);
    req.session.userid = creds.userid;
    req.session.username = creds.username;
    req.session.savings = account.savings;
    req.session.plant = decoratePlant(account.plant);
    req.session.contract = account.contract;
    return res.json({ redirect: '/bank' });
}));

app.post('/signupUser', asyncRoute(async (req, res) => {
    const { username, password } = req.body;
    const cred = await database.findUser(username);

    if (cred.detected) {
        return res.status(404).send('User already exists');
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        await database.insert(username, hash);
        return res.status(300).send();
    } catch (error) {
        console.log('Could not store credentials', error);
        return res.status(500).send('Could not create account');
    }
}));

app.get('/logout', asyncRoute(async (req, res) => {
    if (req.session.userid) {
        await database.updateAccountState(req.session.userid, {
            account: req.session.savings,
            ...req.session.plant,
            contract: req.session.contract
        });
    }
    req.session.destroy(() => {
        res.redirect('/');
    });
}));

app.get('/bank', asyncRoute(async (req, res) => {
    if (!req.session.userid) {
        return res.redirect('/login');
    }
    await refreshSessionState(req);
    res.render('bank', { session: req.session, walletConfig: walletConfig() });
}));

app.get('/getSession', asyncRoute(async (req, res) => {
    if (!req.session.userid) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    await refreshSessionState(req);
    res.json({
        username: req.session.username,
        userid: req.session.userid,
        savings: req.session.savings,
        plant: req.session.plant,
        contract: req.session.contract
    });
}));

app.post('/updateSession', asyncRoute(async (req, res) => {
    if (!req.session.userid) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const amount = Number(req.body.amount);
    const action = String(req.body.action || '').trim();
    if (Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    await refreshSessionState(req);

    let contractEvent;
    if (action === 'deposit') {
        contractEvent = contractService.deposit({
            currentBalance: req.session.savings,
            amount,
            eventCount: req.session.contract?.eventCount || 0
        });
    } else if (action === 'withdraw') {
        contractEvent = contractService.withdraw({
            currentBalance: req.session.savings,
            amount,
            eventCount: req.session.contract?.eventCount || 0
        });
    } else {
        return res.status(400).json({ error: 'Unknown contract balance action' });
    }

    if (contractEvent.error) {
        return res.status(400).json({ error: contractEvent.error });
    }

    req.session.savings = contractEvent.balance;
    req.session.contract = {
        ...req.session.contract,
        balance: contractEvent.balance,
        status: contractEvent.status,
        lastEvent: contractEvent.lastEvent,
        lastTxHash: contractEvent.txHash,
        eventCount: contractEvent.eventCount
    };

    await database.updateAccountState(req.session.userid, {
        account: req.session.savings,
        ...req.session.plant,
        contract: req.session.contract
    });

    return res.json({
        savings: req.session.savings,
        contract: req.session.contract,
        message: `${action === 'deposit' ? 'Deposit' : 'Withdraw'} recorded by contract.`
    });
}));

app.post('/wallet/sync', asyncRoute(async (req, res) => {
    if (!req.session.userid) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const balance = Number(req.body.balance);
    const walletAddress = String(req.body.walletAddress || '').trim();
    const chainId = String(req.body.chainId || '').trim().toLowerCase();
    const txHash = String(req.body.txHash || '').trim();
    const action = String(req.body.action || 'WalletBalanceSynced').trim();

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Invalid MetaMask wallet address' });
    }

    if (Number.isNaN(balance) || balance < 0) {
        return res.status(400).json({ error: 'Invalid wallet balance' });
    }

    if (chainId !== '0xaa36a7') {
        return res.status(400).json({ error: 'ChainBloom only syncs Sepolia MetaMask balances.' });
    }

    await refreshSessionState(req);

    const eventCount = (req.session.contract?.eventCount || 0) + 1;
    req.session.savings = balance;
    req.session.contract = {
        ...req.session.contract,
        balance,
        status: 'MetaMask Balance Synced',
        lastEvent: action,
        lastTxHash: txHash || req.session.contract?.lastTxHash,
        eventCount,
        walletAddress,
        walletChainId: chainId
    };

    await database.updateAccountState(req.session.userid, {
        account: req.session.savings,
        ...req.session.plant,
        contract: req.session.contract
    });

    return res.json({
        savings: req.session.savings,
        contract: req.session.contract,
        message: 'MetaMask balance synced.'
    });
}));

app.post('/garden/action', asyncRoute(async (req, res) => {
    if (!req.session.userid) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const action = req.body.action;
    const costs = { water: 0.00003, feed: 0.00007, sunlight: 0.00005 };
    if (!costs[action]) {
        return res.status(400).json({ error: 'Unknown garden action' });
    }
    const walletAddress = String(req.body.walletAddress || '').trim();
    const chainId = String(req.body.chainId || '').trim().toLowerCase();
    const txHash = String(req.body.txHash || '').trim();

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Invalid MetaMask wallet address' });
    }

    if (chainId !== '0xaa36a7') {
        return res.status(400).json({ error: 'Plant care spending only works on Sepolia.' });
    }

    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return res.status(400).json({ error: 'Plant care requires a real Sepolia transaction hash.' });
    }

    await refreshSessionState(req);

    const contractSpend = contractService.spendForCare({
        currentBalance: req.session.savings,
        amount: costs[action],
        action,
        eventCount: req.session.contract?.eventCount || 0
    });

    if (contractSpend.error) {
        return res.status(400).json({ error: contractSpend.error });
    }

    let plant = { ...req.session.plant };
    let savings = contractSpend.balance;

    plant.lastAction = action;
    plant.totalCares = (plant.totalCares || 0) + 1;
    plant.careStreak = (plant.careStreak || 0) + 1;

    if (action === 'water') {
        plant.hydration = Math.min(100, plant.hydration + 18);
        plant.health = Math.min(100, plant.health + 10);
    } else if (action === 'feed') {
        plant.growthPoints = (plant.growthPoints || 0) + 18;
        plant.health = Math.min(100, plant.health + 8);
    } else if (action === 'sunlight') {
        plant.growthPoints = (plant.growthPoints || 0) + 10;
        plant.health = Math.min(100, plant.health + 6);
        plant.sunlightBoosts = (plant.sunlightBoosts || 0) + 1;
    }

    if (plant.growthPoints >= 100) {
        const levels = Math.floor(plant.growthPoints / 100);
        plant.growthStage = Math.min(5, plant.growthStage + levels);
        plant.growthPoints = plant.growthPoints % 100;
    }

    plant.hydration = Math.max(0, Math.min(100, plant.hydration - 4));
    plant.health = Math.max(0, Math.min(100, plant.health));

    plant = decoratePlant(plant);
    req.session.contract = {
        ...req.session.contract,
        balance: contractSpend.balance,
        status: contractSpend.status,
        lastEvent: contractSpend.lastEvent,
        lastTxHash: txHash,
        eventCount: contractSpend.eventCount,
        walletAddress,
        walletChainId: chainId
    };
    req.session.savings = savings;
    req.session.plant = plant;

    await database.updateAccountState(req.session.userid, {
        account: savings,
        ...plant,
        contract: req.session.contract
    });

    return res.json({ savings, plant, contract: req.session.contract, message: `${plant.name} loved that ${action}.` });
}));

app.post('/garden/rename', asyncRoute(async (req, res) => {
    if (!req.session.userid) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const newName = String(req.body.name || '').trim().slice(0, 24);
    if (!newName) {
        return res.status(400).json({ error: 'Plant name cannot be empty.' });
    }

    await refreshSessionState(req);
    req.session.plant = decoratePlant({ ...req.session.plant, name: newName });
    await database.updateAccountState(req.session.userid, {
        account: req.session.savings,
        ...req.session.plant,
        contract: req.session.contract
    });

    return res.json({ plant: req.session.plant, contract: req.session.contract, message: `Plant renamed to ${newName}.` });
}));

app.use((error, req, res, next) => {
    console.error('Request failed:', error.message);
    if (res.headersSent) {
        return next(error);
    }
    return res.status(500).json({
        error: 'Server error. Check database settings and server logs.'
    });
});

const server = app.listen(port, host, () => {
    console.log(`Listening at http://${host}:${port}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the other server or set PORT to another value in .env.`);
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error(`Cannot listen on ${host}:${port}. Try setting HOST=127.0.0.1 and PORT=8080 in .env.`);
    } else {
        console.error('Server failed to start:', error);
    }
    process.exit(1);
});
