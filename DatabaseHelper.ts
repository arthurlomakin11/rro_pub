import { PrismaClient, ReceiptStatus, CashServiceStatus, TransactionStatus,
    ShiftTransactionType, ShiftTransaction, createNativePool} from "artbox_db/index.js";
import {CurrentDate} from "./functions/CurrentDate";


export class DatabaseHelper {
    private context:PrismaClient;

    constructor(context:PrismaClient) {
        this.context = context;
    }

    async getNewReceiptV0() {
        return this.context.receipt.findFirst({
            where: {
                status: ReceiptStatus.ToCreate
            },
            include: {
                cashier: {
                    include: {
                        object: {
                            include: {
                                organization: {
                                    include: {
                                        entrepreneur: true
                                    }
                                }
                            }
                        },
                        keysAccess: {
                            include: {
                                signKey: true
                            }
                        }
                    }
                },
                receiptDetails: {
                    include: {
                        taxes: true,
                        exciseLabels: true
                    }
                },
                payments: true,
            }
        });
    }

    async getFirstToSheduleShiftCashier() {
        const pool = createNativePool();
        let result = null;
        pool.query(`
            SET TIME ZONE 'Europe/Kiev';
            SELECT record."cashierId", record."shiftOpenTime", record."shiftCloseTime", record."shifts" FROM 
                (
                    SELECT c.id  as "cashierId", c."shiftOpenTime", c."shiftCloseTime", COUNT(st) as "transactions_count", concat('[', string_agg(ROW_TO_JSON(st) #>> '{}', ', '), ']') as "shifts" FROM "Cashier" c
                    LEFT OUTER JOIN "ShiftTransaction" st ON st."cashierId" = c."id" 
                        AND st."datetimeToRun"::date = 'now'::date
                        AND (
                            st."datetimeToRun"::time = c."shiftOpenTime" OR
                            st."datetimeToRun"::time = c."shiftCloseTime"                          
                        )
                        AND st."automatic" = true
                    WHERE c."shiftOpenTime" IS NOT NULL AND c."shiftCloseTime" IS NOT NULL
                    GROUP BY c.id
                ) record
            WHERE record."transactions_count" < 3
            LIMIT 1`, (err, res) => {
            if (err) {
                throw err;
            }

            if (res) {
                const toProcess = (res as any).filter(el => el.command == "SELECT");
                if (!!toProcess && !!toProcess[0] && !!toProcess[0].rows && !!toProcess[0].rows[0]) {
                    result = toProcess[0].rows[0];
                    result.shifts = JSON.parse(result.shifts); // transform json string to js object
                }
            }
        })
        await pool.end();

        return result;
    }

    async getFirstToSheduleShiftOutput() {
        const pool = createNativePool();
        let result = null;
        pool.query(`
            SET TIME ZONE 'Europe/Kiev';
            SELECT c."id" as "cashierId", c."shiftOutputTime" FROM "Cashier" c
            LEFT OUTER JOIN "ShiftTransaction" st ON st."cashierId" = c."id" 
                AND st."type" = 'ServiceOutput'::public."ShiftTransactionType"
                AND st."datetimeToRun"::date = 'now'::date
                AND st."datetimeToRun"::time = c."shiftOutputTime"
                AND st."automatic" = true
            WHERE c."shiftOutputTime" IS NOT NULL 
            AND st IS NULL
            LIMIT 1`, (err, res) => {
            if (err) {
                throw err;
            }

            if (res) {
                const toProcess = (res as any).filter(el => el.command == "SELECT");
                if (!!toProcess && !!toProcess[0] && !!toProcess[0].rows && !!toProcess[0].rows[0]) {
                    result = toProcess[0].rows[0];
                    // result = JSON.parse(result);
                }
            }
        })
        await pool.end();

        return result;
    }

    async addManyShiftTransactions(shiftTransactionsArray: ShiftTransaction[]) {
        return this.context.shiftTransaction.createMany({
            data: shiftTransactionsArray
        })
    }

    async addShiftTransaction(shiftTransaction: ShiftTransaction) {
        return this.context.shiftTransaction.create({
            data: shiftTransaction
        })
    }

    async getNewShiftTransaction() {
        const dateNow = new Date();
        dateNow.setHours(dateNow.getHours() + CurrentDate.getTimeZoneOffset())

        return this.context.shiftTransaction.findFirst({
            where: {
                AND: [
                    {
                        status: TransactionStatus.ToCreate
                    },
                    {
                        datetimeToRun: {
                            lt: dateNow
                        }
                    }
                ]
            },
            orderBy: [
                {
                    priority: 'desc',
                },
                {
                    datetimeToRun: 'asc',
                },
            ],
            include: {
                cashier: {
                    include: {
                        object: {
                            include: {
                                organization: {
                                    include: {
                                        entrepreneur: true
                                    }
                                }
                            }
                        },
                        keysAccess: {
                            include: {
                                signKey: true
                            }
                        }
                    }
                }
            }
        });
    }

    async getNewXReport() {
        return this.context.xReport.findFirst({
            where: {
                status: TransactionStatus.ToCreate
            },
            include: {
                cashier: {
                    include: {
                        keysAccess: {
                            include: {
                                signKey: true
                            }
                        }
                    }
                }
            }
        });
    }

    async getFirstPeriodicalReport() {
        return this.context.periodicalReport.findFirst({
            where: {
                AND: [
                    {
                        status: TransactionStatus.ToCreate
                    },
                ]
            },
            include: {
                cashier: {
                    include: {
                        keysAccess: {
                            include: {
                                signKey: true
                            }
                        }
                    }
                }
            }
        });
    }

    async getNewService() {
        return this.context.cashService.findFirst({
            where: {
                status: CashServiceStatus.ToCreate
            },
            include: {
                cashier: {
                    include: {
                        object: {
                            include: {
                                organization: {
                                    include: {
                                        entrepreneur: true
                                    }
                                }
                            }
                        },
                        keysAccess: {
                            include: {
                                signKey: true
                            }
                        }
                    }
                }
            }
        });
    }

    async UpdatePeriodicalReport(reportId:number, newData: object) {
        await this.context.periodicalReport.update({
            where: { id: reportId },
            data: newData,
        })
    }

    async UpdateServiceStatus(serviceId:number, newStatus:CashServiceStatus) {
        await this.context.cashService.update({
            where: { id: serviceId },
            data: {
                status: newStatus
            },
        })
    }

    async UpdateService(serviceId:number, data:any) {
        await this.context.cashService.update({
            where: { id: serviceId },
            data: data,
        })
    }

    async UpdateXReport(reportId:number, reportData:object) {
        await this.context.xReport.update({
            where: { id: reportId },
            data: reportData
        })
    }

    async UpdateShiftTransaction(shiftId:number, new_data:object) {
        await this.context.shiftTransaction.update({
            where: { id: shiftId },
            data: new_data,
        })
    }

    async AddHighPriorityZRepTransaction(cashierId:number, priority) {
        await this.context.shiftTransaction.create({
            data: {
                cashierId: cashierId,
                datetimeToRun: new Date(),
                status: TransactionStatus.ToCreate,
                type: ShiftTransactionType.ZRep,
                priority: priority
            }
        })
    }

    async UpdateLocalCounter(cashierId:number, number:number) {
        await this.context.cashier.update({
            where: { id: cashierId },
            data: {
                localCounter: number
            },
        })
    }

    async UpdateReceiptStatus(receiptId:number, status:ReceiptStatus) {
        await this.context.receipt.update({
            where: { id: receiptId },
            data: {
                status: status
            },
        })
    }

    async UpdateReceipt(receiptId:number, dataObject:object) {
        await this.context.receipt.update({
            where: { id: receiptId },
            data: dataObject,
        })
    }

    async getZRepBalance(cashierId:number) {
        const zRepBalance = await this.context.shiftTransaction.aggregate({
            where: {
                status: TransactionStatus.Done,
                type: ShiftTransactionType.ZRep,
                cashierId: cashierId
            },
            _sum: {
                localBalance: true
            }
        })

        return zRepBalance._sum.localBalance ?? 0
    }
}