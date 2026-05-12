const depositBtn = document.getElementById('depositBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const depositAmt = document.getElementById('deposit');
const withdrawAmt = document.getElementById('withdraw');
const savingsLabel = document.getElementById('savingsLabel');
const metamaskBtn = document.getElementById('metamaskBtn');
const waterBtn = document.getElementById('waterBtn');
const feedBtn = document.getElementById('feedBtn');
const sunlightBtn = document.getElementById('sunlightBtn');
const renameBtn = document.getElementById('renameBtn');
const plantNameInput = document.getElementById('plantNameInput');
const plantNameLabel = document.getElementById('plantNameLabel');
const plantEmoji = document.getElementById('plantEmoji');
const nftLabel = document.getElementById('nftLabel');
const contractBalanceLabel = document.getElementById('contractBalanceLabel');
const contractStatusLabel = document.getElementById('contractStatusLabel');
const contractEventLabel = document.getElementById('contractEventLabel');
const contractTxLabel = document.getElementById('contractTxLabel');
const contractEventCountLabel = document.getElementById('contractEventCountLabel');
const growthStageLabel = document.getElementById('growthStageLabel');
const hydrationLabel = document.getElementById('hydrationLabel');
const healthLabel = document.getElementById('healthLabel');
const moodLabel = document.getElementById('moodLabel');
const streakLabel = document.getElementById('streakLabel');
const totalCareLabel = document.getElementById('totalCareLabel');
const actionLabel = document.getElementById('actionLabel');
const growthBar = document.getElementById('growthBar');
const contractHint = document.getElementById('contractHint');

const getSessionURL = '/getSession';
const updateSessionURL = '/updateSession';
const gardenActionURL = '/garden/action';
const renamePlantURL = '/garden/rename';
const walletSyncURL = '/wallet/sync';
const walletConfig = window.chainBloomWalletConfig || {};
const SEPOLIA_CHAIN_ID = walletConfig.requiredChainId || '0xaa36a7';
const SEPOLIA_LABEL = 'SepoliaETH';
const CARE_COSTS = walletConfig.careCosts || { water: 0.00003, sunlight: 0.00005, feed: 0.00007 };
let session;
let currentAmount;
let walletAddress = '';
let chainId = '';

const sessionReady = getSession();

document.addEventListener('DOMContentLoaded', () => {
    depositBtn.addEventListener('click', deposit);
    withdrawBtn.addEventListener('click', withdraw);
    metamaskBtn.addEventListener('click', openMetaMask);
    waterBtn.addEventListener('click', () => careForPlant('water'));
    feedBtn.addEventListener('click', () => careForPlant('feed'));
    sunlightBtn.addEventListener('click', () => careForPlant('sunlight'));
    renameBtn.addEventListener('click', renamePlant);
    bindMetaMaskEvents();
    sessionReady.then(connectIfAlreadyAuthorized);
});

async function getSession() {
    const res = await fetch(getSessionURL, { method: 'GET' });
    session = await res.json();
    currentAmount = Number(session.savings);
    renderSavings();
    renderPlant(session.plant);
    renderContract(session.contract);
}

function renderSavings() {
    savingsLabel.textContent = 'MetaMask Sepolia Balance: ' + formatEth(currentAmount) + ' ' + SEPOLIA_LABEL;
}

function renderPlant(plant) {
    if (!plant) return;
    plantNameLabel.textContent = plant.name;
    plantEmoji.textContent = plant.emoji || '🌱';
    nftLabel.textContent = 'NFT ID: ' + plant.nftId;
    growthStageLabel.textContent = 'Growth Stage: ' + plant.growthStage + ' / 5';
    hydrationLabel.textContent = 'Hydration: ' + plant.hydration + '%';
    healthLabel.textContent = 'Health: ' + plant.health + '%';
    moodLabel.textContent = 'Mood: ' + plant.moodLabel;
    streakLabel.textContent = 'Care Streak: ' + plant.careStreak;
    totalCareLabel.textContent = 'Total Cares: ' + plant.totalCares;
    actionLabel.textContent = 'Last Action: ' + plant.lastAction;
    growthBar.style.width = plant.growthPoints + '%';
    contractHint.textContent = 'Connect MetaMask on Sepolia to sync this ChainBloom account with its saved wallet.';
}

function renderContract(contract) {
    if (!contract) return;
    const wallet = contract.walletAddress ? ' (' + shortAddress(contract.walletAddress) + ')' : '';
    contractBalanceLabel.textContent = 'Synced Sepolia Wallet Balance: ' + formatEth(contract.balance) + ' ' + SEPOLIA_LABEL + wallet;
    contractStatusLabel.textContent = 'Contract Status: ' + contract.status;
    contractEventLabel.textContent = 'Last Contract Action: ' + contract.lastEvent;
    if (contract.lastTxHash) {
        contractTxLabel.innerHTML = 'Last Tx: <a href="' + sepoliaTxUrl(contract.lastTxHash) + '" target="_blank" rel="noopener">' + contract.lastTxHash + '</a>';
    } else {
        contractTxLabel.textContent = 'Last Tx: Pending';
    }
    contractEventCountLabel.textContent = 'Contract Events: ' + contract.eventCount;
}

async function deposit(e) {
    e.preventDefault();
    if (depositAmt.value === '') return;
    const amount = parseFloat(depositAmt.value);
    if (isNaN(amount) || amount <= 0) {
        alert('Enter a valid deposit amount.');
        depositAmt.value = '';
        return;
    }
    depositAmt.value = '';
    await openMetaMaskBuy();
}

async function withdraw(e) {
    e.preventDefault();
    if (withdrawAmt.value === '') return;
    const amount = parseFloat(withdrawAmt.value);
    if (isNaN(amount) || amount <= 0) {
        alert('Enter a valid withdraw amount.');
        withdrawAmt.value = '';
        return;
    }
    if (!walletConfig.bankWalletAddress || !isEthAddress(walletConfig.bankWalletAddress)) {
        alert('Set BANK_WALLET_ADDRESS in .env to receive withdrawals.');
        withdrawAmt.value = '';
        return;
    }
    if (amount > currentAmount) {
        alert('Not enough SepoliaETH in your MetaMask wallet.');
        withdrawAmt.value = '';
        return;
    }
    withdrawAmt.value = '';
    const txHash = await sendEth(walletConfig.bankWalletAddress, amount);
    if (txHash) {
        await refreshWalletBalance('MetaMaskWithdraw', txHash);
    }
}

async function syncWalletBalance(action, txHash) {
    const res = await fetch(walletSyncURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action,
            txHash,
            walletAddress,
            chainId,
            balance: currentAmount
        })
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || 'Could not sync MetaMask balance.');
        return;
    }
    currentAmount = Number(data.savings);
    session.savings = currentAmount;
    session.contract = data.contract;
    renderSavings();
    renderContract(data.contract);
}

async function careForPlant(action) {
    if (!walletAddress) {
        const connected = await connectMetaMask();
        if (!connected) return;
    }

    if (!walletConfig.careWalletAddress || !isEthAddress(walletConfig.careWalletAddress)) {
        alert('Set CARE_WALLET_ADDRESS or BANK_WALLET_ADDRESS in .env so plant care can receive SepoliaETH.');
        return;
    }

    const amount = Number(CARE_COSTS[action]);
    if (!amount || amount <= 0) {
        alert('Unknown plant care cost.');
        return;
    }

    if (amount > currentAmount) {
        alert('Not enough SepoliaETH in your MetaMask wallet.');
        return;
    }

    contractHint.textContent = 'Approve the ' + action + ' Sepolia transaction in MetaMask.';
    const txHash = await sendEth(walletConfig.careWalletAddress, amount);
    if (!txHash) return;

    const res = await fetch(gardenActionURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action,
            txHash,
            walletAddress,
            chainId
        })
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || 'Could not complete garden action.');
        return;
    }
    session.plant = data.plant;
    session.contract = data.contract;
    renderPlant(data.plant);
    renderContract(data.contract);
    contractHint.innerHTML = 'SepoliaETH sent for plant care. View it on <a href="' + sepoliaTxUrl(txHash) + '" target="_blank" rel="noopener">Sepolia Etherscan</a>.';
    await refreshWalletBalance('MetaMaskCareSpend', txHash, 'pending');
}

async function renamePlant(e) {
    e.preventDefault();
    const name = plantNameInput.value.trim();
    if (!name) {
        alert('Enter a plant name first.');
        return;
    }
    const res = await fetch(renamePlantURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || 'Could not rename plant.');
        return;
    }
    session.plant = data.plant;
    session.contract = data.contract;
    renderPlant(data.plant);
    renderContract(data.contract);
    plantNameInput.value = '';
}

async function openMetaMask(e) {
    e.preventDefault();
    await connectMetaMask();
}

async function connectIfAlreadyAuthorized() {
    if (!window.ethereum || !session?.contract?.walletAddress) return;
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const savedWallet = session.contract.walletAddress.toLowerCase();
        const savedAccount = (accounts || []).find((account) => account.toLowerCase() === savedWallet);
        if (savedAccount) {
            await setConnectedWallet(savedAccount);
        } else {
            metamaskBtn.textContent = 'Reconnect ' + shortAddress(session.contract.walletAddress);
            contractHint.textContent = 'This ChainBloom account is linked to ' + shortAddress(session.contract.walletAddress) + '. Select that MetaMask account and reconnect.';
        }
    } catch (error) {
        console.error('Could not check MetaMask account', error);
    }
}

async function connectMetaMask() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || !accounts.length) return false;
            await ensureSepoliaNetwork();
            await setConnectedWallet(accounts[0]);
            return true;
        } catch (error) {
            alert('MetaMask did not connect.');
            return false;
        }
    }

    window.open('https://metamask.io/download/', '_blank', 'noopener');
    return false;
}

async function setConnectedWallet(address) {
    walletAddress = address;
    chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
        await ensureSepoliaNetwork();
        chainId = await window.ethereum.request({ method: 'eth_chainId' });
    }
    metamaskBtn.textContent = shortAddress(address) + ' connected';
    contractHint.textContent = 'MetaMask connected on Sepolia. Reading wallet balance...';
    await refreshWalletBalance('MetaMaskBalanceSynced');
}

async function refreshWalletBalance(action, txHash = '', blockTag = 'latest') {
    if (!walletAddress || !window.ethereum) return;
    try {
        const balanceHex = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [walletAddress, blockTag]
        });
        currentAmount = weiHexToEth(balanceHex);
        renderSavings();
        if (!txHash) {
            contractHint.textContent = 'Sepolia MetaMask synced from ' + shortAddress(walletAddress) + ' for this ChainBloom account.';
        }
        await syncWalletBalance(action, txHash);
    } catch (error) {
        alert(error?.message || 'Could not read MetaMask balance.');
    }
}

async function sendEth(to, amountEth) {
    const connected = walletAddress || await connectMetaMask();
    if (!connected && !walletAddress) return '';

    try {
        await ensureSepoliaNetwork();
        return await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: walletAddress,
                to,
                value: ethToWeiHex(amountEth)
            }]
        });
    } catch (error) {
        alert(error?.message || 'MetaMask transaction was not completed.');
        return '';
    }
}

async function openMetaMaskBuy() {
    const connected = walletAddress || await connectMetaMask();
    if (!connected && !walletAddress) return;

    alert('ChainBloom uses SepoliaETH. Use a Sepolia faucet or receive SepoliaETH in MetaMask, then reconnect to refresh the synced balance.');
    window.open(walletConfig.buyUrl || 'https://portfolio.metamask.io/buy', '_blank', 'noopener');
}

function bindMetaMaskEvents() {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', async (accounts) => {
        if (!accounts || !accounts.length) {
            walletAddress = '';
            metamaskBtn.textContent = 'Connect MetaMask';
            return;
        }
        await setConnectedWallet(accounts[0]);
    });

    window.ethereum.on('chainChanged', async (nextChainId) => {
        chainId = nextChainId;
        if (walletAddress) {
            if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
                contractHint.textContent = 'Switch MetaMask back to Sepolia to sync ChainBloom.';
                return;
            }
            await refreshWalletBalance('MetaMaskNetworkChanged');
        }
    });
}

async function ensureSepoliaNetwork() {
    const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChain.toLowerCase() === SEPOLIA_CHAIN_ID) {
        chainId = currentChain.toLowerCase();
        return;
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }]
        });
    } catch (error) {
        if (error?.code !== 4902) {
            throw error;
        }

        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: SEPOLIA_CHAIN_ID,
                chainName: 'Sepolia',
                nativeCurrency: {
                    name: 'Sepolia Ether',
                    symbol: 'ETH',
                    decimals: 18
                },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
        });
    }

    chainId = SEPOLIA_CHAIN_ID;
}

function isEthAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function shortAddress(address) {
    return address.slice(0, 6) + '...' + address.slice(-4);
}

function sepoliaTxUrl(txHash) {
    const baseUrl = walletConfig.explorerBaseUrl || 'https://sepolia.etherscan.io';
    return baseUrl + '/tx/' + txHash;
}

function weiHexToEth(hexValue) {
    const wei = BigInt(hexValue);
    const whole = wei / 1000000000000000000n;
    const fraction = wei % 1000000000000000000n;
    return Number(whole.toString() + '.' + fraction.toString().padStart(18, '0'));
}

function ethToWeiHex(amountEth) {
    const value = String(amountEth).trim();
    if (!/^\d+(\.\d{1,18})?$/.test(value)) {
        throw new Error('Invalid ETH amount.');
    }

    const [whole, fraction = ''] = value.split('.');
    const wei = BigInt(whole) * 1000000000000000000n + BigInt(fraction.padEnd(18, '0'));
    return '0x' + wei.toString(16);
}

function formatEth(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '0.000000';
    if (value === 0) return '0.000000';
    if (value < 0.000001) return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
    return value.toFixed(6);
}
