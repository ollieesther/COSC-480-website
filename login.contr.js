const Sequelize = require('sequelize');
var DataTypes = require('sequelize/lib/data-types');
const contractService = require('./contract.service');
require('dotenv').config();

class Controller {
    #hostname;
    #user;
    #pass;
    #db;
    #db_dialect;
    #port;
    #sequelize;
    #User;
    #Account;
    #useMemory = false;
    #memoryUsers = new Map();
    #memoryAccounts = new Map();
    #nextUserId = 1;

    constructor() {
        this.#hostname = process.env.DB_HOST;
        this.#user = process.env.DB_USER;
        this.#pass = process.env.DB_PASSWORD;
        this.#db = process.env.DB_DATABASE;
        this.#port = process.env.DB_PORT;
        this.#db_dialect = process.env.DB_DIALECT;

        this.#sequelize = new Sequelize(this.#db, this.#user, this.#pass, {
            host: this.#hostname,
            port: this.#port,
            dialect: this.#db_dialect,
            logging: false
        });

        this.#sequelize.authenticate().then(() => {
            console.log('Database connection has been established successfully.');
        }).catch((error) => {
            this.#useMemory = true;
            console.error('Unable to connect to the database. Using in-memory demo storage:', error.message);
        });

        this.#User = this.#sequelize.define('user', {
            username: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            password: {
                type: DataTypes.STRING,
                allowNull: false
            }
        });

        this.#Account = this.#sequelize.define('accounts', {
            account: {
                type: DataTypes.FLOAT,
                allowNull: false,
                defaultValue: 25
            },
            plantName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Sproutling'
            },
            nftId: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'NFT-SEED'
            },
            hydration: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 65
            },
            health: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 72
            },
            growthStage: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            growthPoints: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            careStreak: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            totalCares: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            sunlightBoosts: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            lastAction: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Minted'
            },
            contractAddress: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '0xChainBloomDemoContract'
            },
            contractStatus: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Account Opened'
            },
            mintedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            lastContractEvent: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'ContractAccountOpened'
            },
            lastTxHash: {
                type: DataTypes.STRING,
                allowNull: true
            },
            contractEventCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            walletAddress: {
                type: DataTypes.STRING,
                allowNull: true
            },
            walletChainId: {
                type: DataTypes.STRING,
                allowNull: true
            }
        });

        const accountForeignKey = { name: 'userId', allowNull: false };
        this.#User.hasOne(this.#Account, {
            foreignKey: accountForeignKey,
            onDelete: 'CASCADE'
        });
        this.#Account.belongsTo(this.#User, {
            foreignKey: accountForeignKey,
            onDelete: 'CASCADE'
        });
    }

    async ensureSync() {
        if (this.#useMemory) return;
        try {
            await this.#sequelize.sync();
            await this.ensureAccountColumns();
        } catch (error) {
            this.#useMemory = true;
            console.error('Database sync failed. Using in-memory demo storage:', error.message);
        }
    }

    async ensureAccountColumns() {
        const queryInterface = this.#sequelize.getQueryInterface();
        const table = await queryInterface.describeTable('accounts');
        const columns = {
            plantName: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Sproutling'
            },
            nftId: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'NFT-SEED'
            },
            hydration: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 65
            },
            health: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 72
            },
            growthStage: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            growthPoints: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            careStreak: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            totalCares: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            sunlightBoosts: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            lastAction: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Minted'
            },
            contractAddress: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '0xChainBloomDemoContract'
            },
            contractStatus: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Account Opened'
            },
            mintedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            lastContractEvent: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'ContractAccountOpened'
            },
            lastTxHash: {
                type: DataTypes.STRING,
                allowNull: true
            },
            contractEventCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            walletAddress: {
                type: DataTypes.STRING,
                allowNull: true
            },
            walletChainId: {
                type: DataTypes.STRING,
                allowNull: true
            }
        };

        for (const [name, definition] of Object.entries(columns)) {
            if (!table[name]) {
                await queryInterface.addColumn('accounts', name, definition);
            }
        }
    }

    buildContract(accountRow) {
        return {
            address: accountRow.contractAddress,
            balance: accountRow.account,
            status: accountRow.contractStatus,
            mintedAt: accountRow.mintedAt,
            lastEvent: accountRow.lastContractEvent,
            lastTxHash: accountRow.lastTxHash,
            eventCount: accountRow.contractEventCount,
            walletAddress: accountRow.walletAddress,
            walletChainId: accountRow.walletChainId
        };
    }

    buildPlant(accountRow, username='Gardener') {
        return {
            name: accountRow.plantName,
            nftId: accountRow.nftId,
            hydration: accountRow.hydration,
            health: accountRow.health,
            growthStage: accountRow.growthStage,
            growthPoints: accountRow.growthPoints,
            careStreak: accountRow.careStreak,
            totalCares: accountRow.totalCares,
            sunlightBoosts: accountRow.sunlightBoosts,
            lastAction: accountRow.lastAction,
            owner: username
        };
    }

    async insert(user, pword) {
        await this.ensureSync();
        const startingBalance = 25;
        const contractAccount = contractService.openAccount({ username: user, startingBalance });
        const nftId = `NFT-${user.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PLANT'}-${Date.now().toString().slice(-6)}`;

        if (this.#useMemory) {
            const id = this.#nextUserId++;
            this.#memoryUsers.set(user, {
                id,
                username: user,
                password: pword
            });
            this.#memoryAccounts.set(id, {
                userId: id,
                account: startingBalance,
                plantName: `${user}'s Plant`,
                nftId,
                hydration: 65,
                health: 72,
                growthStage: 1,
                growthPoints: 0,
                careStreak: 0,
                totalCares: 0,
                sunlightBoosts: 0,
                lastAction: 'Minted',
                contractAddress: contractAccount.address,
                contractStatus: contractAccount.status,
                mintedAt: contractAccount.openedAt,
                lastContractEvent: contractAccount.lastEvent,
                lastTxHash: contractAccount.txHash,
                contractEventCount: contractAccount.eventCount,
                walletAddress: null,
                walletChainId: null,
                user: { username: user }
            });
            return;
        }

        await this.#User.create({
            username: user,
            password: pword,
            account: {
                account: startingBalance,
                plantName: `${user}'s Plant`,
                nftId,
                hydration: 65,
                health: 72,
                growthStage: 1,
                growthPoints: 0,
                careStreak: 0,
                totalCares: 0,
                sunlightBoosts: 0,
                lastAction: 'Minted',
                contractAddress: contractAccount.address,
                contractStatus: contractAccount.status,
                mintedAt: contractAccount.openedAt,
                lastContractEvent: contractAccount.lastEvent,
                lastTxHash: contractAccount.txHash,
                contractEventCount: contractAccount.eventCount,
                walletAddress: null,
                walletChainId: null
            }
        }, {
            include: this.#Account
        });
    }

    async findUser(user) {
        await this.ensureSync();
        if (this.#useMemory) {
            const result = this.#memoryUsers.get(user);
            if (!result) return { detected: false, res: null };
            return { detected: true, res: result };
        }

        const result = await this.#User.findOne({
            where: { username: user },
            raw: true
        });

        if (!result) return { detected: false, res: null };
        return { detected: true, res: result };
    }

    async select(user) {
        await this.ensureSync();
        if (this.#useMemory) {
            const result = this.#memoryUsers.get(user);
            if (!result) {
                return { detected: false, res: null, password: null };
            }
            return {
                detected: true,
                res: result,
                username: result.username,
                password: result.password,
                userid: result.id
            };
        }

        const result = await this.#User.findOne({
            where: { username: user },
            raw: true
        });

        if (!result) {
            return { detected: false, res: null, password: null };
        }
        return {
            detected: true,
            res: result,
            username: result.username,
            password: result.password,
            userid: result.id
        };
    }

    async getAccount(userId) {
        await this.ensureSync();
        if (this.#useMemory) {
            const raw = this.#memoryAccounts.get(Number(userId));
            if (!raw) {
                return { detected: false, res: null };
            }
            return {
                detected: true,
                savings: raw.account,
                plant: this.buildPlant(raw, raw.user?.username),
                contract: this.buildContract(raw)
            };
        }

        const account = await this.#Account.findOne({
            where: { userId },
            include: [{ model: this.#User, attributes: ['username'] }]
        });

        if (!account) {
            return { detected: false, res: null };
        }

        const raw = account.get({ plain: true });
        return {
            detected: true,
            savings: raw.account,
            plant: this.buildPlant(raw, raw.user?.username),
            contract: this.buildContract(raw)
        };
    }

    async updateAccountState(userId, state) {
        await this.ensureSync();
        const payload = {
            account: state.account,
            plantName: state.name,
            nftId: state.nftId,
            hydration: state.hydration,
            health: state.health,
            growthStage: state.growthStage,
            growthPoints: state.growthPoints,
            careStreak: state.careStreak,
            totalCares: state.totalCares,
            sunlightBoosts: state.sunlightBoosts,
            lastAction: state.lastAction
        };

        if (state.contract) {
            payload.contractAddress = state.contract.address;
            payload.contractStatus = state.contract.status;
            payload.mintedAt = state.contract.mintedAt;
            payload.lastContractEvent = state.contract.lastEvent;
            payload.lastTxHash = state.contract.lastTxHash;
            payload.contractEventCount = state.contract.eventCount;
            payload.walletAddress = state.contract.walletAddress;
            payload.walletChainId = state.contract.walletChainId;
        }

        if (this.#useMemory) {
            const account = this.#memoryAccounts.get(Number(userId));
            if (!account) return { detected: false, res: null };
            this.#memoryAccounts.set(Number(userId), {
                ...account,
                ...payload
            });
            return { detected: true, res: [1] };
        }

        const result = await this.#Account.update(payload, {
            where: { userId }
        });

        if (!result) return { detected: false, res: null };
        return { detected: true, res: result };
    }
}

module.exports = Controller;
