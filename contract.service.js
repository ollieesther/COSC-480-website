const crypto = require('crypto');

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xChainBloomDemoContract';

function nowIso() {
    return new Date().toISOString();
}

function shortHash(input) {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function txHash(type, payload) {
    return `0x${shortHash(`${type}:${JSON.stringify(payload)}:${Date.now()}`)}`;
}

function money(value) {
    return Number(value.toFixed(6));
}

class ContractService {
    openAccount({ username, startingBalance }) {
        const payload = { username, startingBalance, contractAddress: CONTRACT_ADDRESS, openedAt: nowIso() };
        return {
            address: CONTRACT_ADDRESS,
            status: 'Account Opened',
            lastEvent: 'ContractAccountOpened',
            eventCount: 1,
            txHash: txHash('ContractAccountOpened', payload),
            openedAt: payload.openedAt
        };
    }

    deposit({ currentBalance, amount, eventCount = 0 }) {
        const nextBalance = money(currentBalance + amount);
        const payload = { amount, nextBalance, contractAddress: CONTRACT_ADDRESS };
        return {
            balance: nextBalance,
            status: 'Deposit Recorded',
            lastEvent: 'ContractDeposit',
            eventCount: eventCount + 1,
            txHash: txHash('ContractDeposit', payload)
        };
    }

    withdraw({ currentBalance, amount, eventCount = 0 }) {
        if (amount > currentBalance) {
            return { error: 'Not enough contract balance.' };
        }

        const nextBalance = money(currentBalance - amount);
        const payload = { amount, nextBalance, contractAddress: CONTRACT_ADDRESS };
        return {
            balance: nextBalance,
            status: 'Withdraw Recorded',
            lastEvent: 'ContractWithdraw',
            eventCount: eventCount + 1,
            txHash: txHash('ContractWithdraw', payload)
        };
    }

    spendForCare({ currentBalance, amount, action, eventCount = 0 }) {
        if (amount > currentBalance) {
            return { error: `Not enough contract balance. ${action} costs ${amount} SepoliaETH.` };
        }

        const nextBalance = money(currentBalance - amount);
        const payload = { amount, action, nextBalance, contractAddress: CONTRACT_ADDRESS };
        return {
            balance: nextBalance,
            status: 'Care Spend Recorded',
            lastEvent: 'ContractCareSpend',
            eventCount: eventCount + 1,
            txHash: txHash('ContractCareSpend', payload)
        };
    }
}

module.exports = new ContractService();
