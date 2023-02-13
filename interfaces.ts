export interface ReqData {
    statusCode:number;
    statusMessage:string;
    data:Buffer;//string;
}

export interface CertSubject {
    commonName:string,
    surname?: string,
    givenName?: string,
    serialNumber?: string,
    countryName?: string,
    localityName?: string,
}


//----------------------------------------------

export interface RequestCommand
{
    Command:string
}

//--------------------------
export type RequestServerState=RequestCommand;

//--------------------------
export interface RequestRROState extends RequestCommand
{
    NumFiscal:number,//Фіскальний номер РРО
    OfflineSessionId?:string, //Ідентифікатор офлайн сесії, для якої будуть надіслані пакети документів (не обов’язковий)
    OfflineSeed?:string //Секретне число" для обчислення фіскального номера офлайн документа офлайн сесії, для якої будуть надіслані пакети документів (не обов’язковий)
}

export interface ResponseRROState
{
    ShiftState:number, //0-зміну не відкрито, 1-зміну відкрито
    ShiftId:number, //Ідентифікатор зміни,
    OpenShiftFiscalNum:string,//Фіскальний номер документа “Відкриття зміни”,
    ZRepPresent:boolean, //Ознака присутності Z-звіту (false/true),
    Name:string, //П.І.Б. оператора, що відкрив зміну,
    IssuerId:number, //Ідентифікатор видавця сертифікату оператора,
    Serial:string, //Серійний номер сертифікату оператора,
    FirstLocalNum:number, //Перший внутрішній номер документа у зміні,
    NextLocalNum:number, //Наступний внутрішній номер документа,
    LastFiscalNum:string, //Останній фіскальний номер документа,
    OfflineSessionId:string, //Ідентифікатор офлайн сесії,
    OfflineSeed:string, //"Секретне число" для обчислення фіскального номера офлайн документа,
    OfflineNextLocalNum:string, //Наступний локальний номер документа в офлайн сесії,
    OfflineSessionDuration:string, //Тривалість офлайн сесії (хвилин),
    OfflineSessionsMonthlyDuration: string //Сумарна тривалість офлайн сесій за поточний місяць (хвилин)
}

//--------------------------
export interface RequestShifts extends RequestCommand
{
    NumFiscal:number, //Фіскальний номер РРО
    From: string, //Дата і час початку періоду
    To: string //Дата і час завершення періоду
//Дата і час представлені текстом у форматі ISO 8601 (наприклад, "2018-10-17T01:23:00+03:00" ) або JavaScript (наприклад, "/Date(1539723599000)/").
}


export interface ShiftItem
{
    ShiftId:number, // Ідентифікатор зміни
    OpenShiftFiscalNum:string, // Фіскальний номер документа “Відкриття зміни”
    Opened:string, // Дата і час відкриття зміни
    OpenName:string, // П.І.Б. оператора, що відкрив зміну
    OpenIssuerId:string, // Ідентифікатор видавця сертифікату оператора
    OpenSerial:string, // Серійний номер сертифікату оператора
    Closed:string, // Дата і час закриття зміни
    CloseName:string, // П.І.Б. оператора, що закрив зміну
    CloseIssuerId:string, // Ідентифікатор видавця сертифікату оператора
    CloseSerial:string, // Серійний номер сертифікату оператора
    ZRepFiscalNum:string // Фіскальний номер документа "Z-звіт"
}

export interface ResponseShifts
{
    Shifts:ShiftItem[]
}

//--------------------------
export interface RequestDocuments extends RequestCommand {
    NumFiscal:number, //Фіскальний номер РРО
    ShiftId: number, //Ідентифікатор зміни
    OpenShiftFiscalNum: string //Фіскальний номер документа “Відкриття зміни
}

export interface DocumentItem {
    NumFiscal:string, //Фіскальний номер документа
    NumLocal:number, //Локальний номер документа
    DocClass: string, //Клас документа (“Check”, “ZRep”)
    CheckDocType: string, //Тип чека (“SaleGoods”, …)>,
    Revoked: boolean //Ознака відкликаного документа
}

export interface ResponseDocuments {
    Documents:DocumentItem[];
}
//--------------------------
export interface RequestDocInfo extends RequestCommand {
    RegistrarNumFiscal:number, //Фіскальний номер РРО
    NumFiscal: string //Фіскальний номер чека/Z-звіту
}

//--------------------------
export interface RequestLastShiftTotals extends RequestCommand {
    NumFiscal:number //Фіскальний номер РРО
}


export interface ShiftTotalsPayForm{
    PayFormCode:string,
    PayFormName:string,
    Sum:number
}

export interface ShiftTotalsTax {
    Type:number,
    Name:string,
    Letter:string,
    Prc:number,
    Sign:boolean,
    Turnover:number,
    Sum:number,
}

export interface ShiftTotalsOrderType {
    Sum:number, //Загальна сума
    TotalCurrencyCommission:number, //Загальна сума комісії від переказів
    OrdersCount:number, //Кількість чеків
    TotalCurrencyCost:number //Кількість операції переказу коштів
    PayForm:ShiftTotalsPayForm[], //Підсумки по формам оплати
    Tax:ShiftTotalsTax[] //Податки/збори
}

export interface ShiftTotals {
    ShiftTotalsOrderType:ShiftTotalsOrderType, //Підсумки реалізації
    //Підсумки повернення
    ServiceInput:number,//Службовий внесок
    ServiceOutput:number//ServiceOutput
}


export interface ResponseLastShiftTotals {
    ShiftState, //0-зміну не відкрито, 1-зміну відкрито
    ZRepPresent, //Ознака присутності Z-звіту (false/true)
    Totals:ShiftTotals
}

export interface TransactionsRegistrarItem {
    NumFiscal :number,
    NumLocal: number
}
export interface TaxObjectItem {
    Address:string,
    Guid:string,
    Name:string,
    Tin:number,
    TransactionsRegistrars:TransactionsRegistrarItem[]
}
export interface ResponseObjects {
    TaxObjects:TaxObjectItem[]
}