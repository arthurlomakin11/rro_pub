// z-report

export function create_z_rep_document(body) {
    return `<?xml version="1.0" encoding="windows-1251"?>
    <ZREP xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="zrep01.xsd">
    ${body}
    </ZREP>`
}

export function generate_zrep(uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, data) {
    let xml =  `
    <ZREPHEAD>
        <UID>${uid}</UID>
        <TIN>${tin}</TIN>`
    if(ipn) {
        xml += `<IPN>${ipn}</IPN>`
    }
    xml += `<ORGNM>${orgnm}</ORGNM>
        <POINTNM>${pointnm}</POINTNM>
        <POINTADDR>${pointaddr}</POINTADDR>
        <ORDERDATE>${orderdate}</ORDERDATE>
        <ORDERTIME>${ordertime}</ORDERTIME>
        <ORDERNUM>${ordernum}</ORDERNUM>
        <CASHDESKNUM>${cashdesknum}</CASHDESKNUM>
        <CASHREGISTERNUM>${cashregisternum}</CASHREGISTERNUM>
        <VER>1</VER>
    </ZREPHEAD>`;
    if(data.Totals !== null) {
        if(data.Totals.Real) {
            xml += `
        <ZREPREALIZ>
            <!--Загальна сума (15.2 цифри)-->
            <SUM>${data.Totals.Real.Sum.toFixed(2)}</SUM>
            <!--Загальна сума коштів, виданих клієнту ломбарда (15.2 цифри)-->
            <PWNSUMISSUED>${data.Totals.Real.PwnSumIssued.toFixed(2)}</PWNSUMISSUED>
            <!--Загальна сума коштів, одержаних від клієнта ломбарда (15.2 цифри)-->
            <PWNSUMRECEIVED>${data.Totals.Real.PwnSumReceived.toFixed(2)}</PWNSUMRECEIVED>
            <!---Кількість чеків (числовий)-->
            <ORDERSCNT>${data.Totals.Real.OrdersCount}</ORDERSCNT>
            <!--Кількість операцій переказу коштів (числовий)-->
            <TOTALCURRENCYCOST>${data.Totals.Real.TotalCurrencyCost}</TOTALCURRENCYCOST>
            <!--Загальна сума переказів коштів (15.2 цифри)-->
            <TOTALCURRENCYSUM>${data.Totals.Real.TotalCurrencySum.toFixed(2)}</TOTALCURRENCYSUM>
            <!--Загальна сума комісії від переказів коштів (15.2 цифри)-->
            <TOTALCURRENCYCOMMISSION>${data.Totals.Real.TotalCurrencyCommission.toFixed(2)}</TOTALCURRENCYCOMMISSION>`;
            if(data.Totals.Real.PayForm && data.Totals.Real.PayForm.length > 0) {
                xml += "<PAYFORMS>";
                data.Totals.Real.PayForm.forEach((payform, number) => {
                    xml += `
            <ROW ROWNUM="${number + 1}">
                <!--Код форми оплати (числовий):-->
                <!--0–Готівка, 1–Банківська картка...-->
                <PAYFORMCD>${payform.PayFormCode}</PAYFORMCD>
                <!--Найменування форми оплати (64 символи)-->
                <PAYFORMNM>${payform.PayFormName}</PAYFORMNM>
                <!--Сума оплати (15.2 цифри)-->
                <SUM>${payform.Sum.toFixed(2)}</SUM>
            </ROW>`
                })
                xml += "</PAYFORMS>"
            }
            if(data.Totals.Real.Tax && data.Totals.Real.Tax.length > 0) {
                xml += "<TAXES>";
                data.Totals.Real.Tax.forEach((tax, number) => {
                    xml += `
            <ROW ROWNUM="${number + 1}">
                <!--Код виду податку/збору (числовий):-->
                <!--0-ПДВ,1-Акциз,2-ПФ...-->
                <TYPE>${tax.Type}</TYPE>
                <!--Найменування виду податку/збору (64 символи)-->
                <NAME>${tax.Name}</NAME>
                <!--Літерне позначення виду і ставки податку/збору (А,Б,В,Г,...)-->
                <LETTER>${tax.Letter}</LETTER>
                <!--Відсоток податку/збору (15.2 цифри)-->
                <PRC>${tax.Prc.toFixed(2)}</PRC>
                <!--Ознака податку/збору, не включеного у вартість-->
                <SIGN>${tax.Sign}</SIGN>
                <!--Сума для розрахування податку/збору (15.2 цифри)-->
                <TURNOVER>${tax.Turnover.toFixed(2)}</TURNOVER>
                <!--Сума податку/збору (15.2 цифри)-->
                <SUM>${tax.Sum.toFixed(2)}</SUM>
            </ROW>`
                })
                xml += "</TAXES>"
            }
            xml += `</ZREPREALIZ>`;
        }
        if(data.Totals.Ret) {
            xml += `<ZREPRETURN>
                <!--Загальна сума (15.2 цифри)-->
            <SUM>${data.Totals.Ret.Sum.toFixed(2)}</SUM>
            <!--Загальна сума коштів, виданих клієнту ломбарда (15.2 цифри)-->
            <PWNSUMISSUED>${data.Totals.Ret.PwnSumIssued.toFixed(2)}</PWNSUMISSUED>
            <!--Загальна сума коштів, одержаних від клієнта ломбарда (15.2 цифри)-->
            <PWNSUMRECEIVED>${data.Totals.Ret.PwnSumReceived.toFixed(2)}</PWNSUMRECEIVED>
            <!---Кількість чеків (числовий)-->
            <ORDERSCNT>${data.Totals.Ret.OrdersCount}</ORDERSCNT>
            <!--Кількість операцій переказу коштів (числовий)-->
            <TOTALCURRENCYCOST>${data.Totals.Ret.TotalCurrencyCost}</TOTALCURRENCYCOST>
            <!--Загальна сума переказів коштів (15.2 цифри)-->
            <TOTALCURRENCYSUM>${data.Totals.Ret.TotalCurrencySum.toFixed(2)}</TOTALCURRENCYSUM>
            <!--Загальна сума комісії від переказів коштів (15.2 цифри)-->
            <TOTALCURRENCYCOMMISSION>${data.Totals.Ret.TotalCurrencyCommission.toFixed(2)}</TOTALCURRENCYCOMMISSION>`;
            if(data.Totals.Ret.PayForm && data.Totals.Ret.PayForm.length > 0) {
                xml += "<PAYFORMS>";
                data.Totals.Ret.PayForm.forEach((payform, number) => {
                    xml += `
            <ROW ROWNUM="${number + 1}">
                <!--Код форми оплати (числовий):-->
                <!--0–Готівка, 1–Банківська картка...-->
                <PAYFORMCD>${payform.PayFormCode}</PAYFORMCD>
                <!--Найменування форми оплати (64 символи)-->
                <PAYFORMNM>${payform.PayFormName}</PAYFORMNM>
                <!--Сума оплати (15.2 цифри)-->
                <SUM>${payform.Sum.toFixed(2)}</SUM>
            </ROW>`
                })
                xml += "</PAYFORMS>"
            }
            if(data.Totals.Ret.Tax && data.Totals.Ret.Tax.length > 0) {
                xml += "<TAXES>";
                data.Totals.Ret.Tax.forEach((tax, number) => {
                    xml += `
            <ROW ROWNUM="${number + 1}">
                <!--Код виду податку/збору (числовий):-->
                <!--0-ПДВ,1-Акциз,2-ПФ...-->
                <TYPE>${tax.Type}</TYPE>
                <!--Найменування виду податку/збору (64 символи)-->
                <NAME>${tax.Name}</NAME>
                <!--Літерне позначення виду і ставки податку/збору (А,Б,В,Г,...)-->
                <LETTER>${tax.Letter}</LETTER>
                <!--Відсоток податку/збору (15.2 цифри)-->
                <PRC>${tax.Prc.toFixed(2)}</PRC>
                <!--Ознака податку/збору, не включеного у вартість-->
                <SIGN>${tax.Sign}</SIGN>
                <!--Сума для розрахування податку/збору (15.2 цифри)-->
                <TURNOVER>${tax.Turnover.toFixed(2)}</TURNOVER>
                <!--Сума податку/збору (15.2 цифри)-->
                <SUM>${tax.Sum.toFixed(2)}</SUM>
            </ROW>`
                })
                xml += "</TAXES>"
            }
            xml += `</ZREPRETURN>`
        }
    }


    if(data.Totals !== null) {
        xml += `
            <ZREPBODY>
                <!--Службове внесення//Отримання авансу/Отримання підкріплення (15.2 цифри)-->
                <SERVICEINPUT>${data.Totals.ServiceInput.toFixed(2)}</SERVICEINPUT>
                <!--Службова видача/Інкасація (15.2 цифри)-->
                <SERVICEOUTPUT>${data.Totals.ServiceOutput.toFixed(2)}</SERVICEOUTPUT>
            </ZREPBODY>`;
    }

    return xml;
}

export function create_xml_document(body) {
    return `<?xml version="1.0" encoding="windows-1251"?>
    <CHECK xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="check01.xsd">
    ${body}
    </CHECK>`
}

// check

export function generate_checkhead(doctype, uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier) {
    let xml = `
        <CHECKHEAD>
            <DOCTYPE>${doctype.doctype}</DOCTYPE>`;
    if(doctype.docsubtype) {
        xml += `<DOCSUBTYPE>${doctype.docsubtype}</DOCSUBTYPE>`
    }
    xml += `<UID>${uid}</UID>
            <TIN>${tin}</TIN>`
    if(ipn) {
        xml += `<IPN>${ipn}</IPN>`
    }
    xml +=  `<ORGNM>${orgnm}</ORGNM>
            <POINTNM>${pointnm}</POINTNM>
            <POINTADDR>${pointaddr}</POINTADDR>
            <ORDERDATE>${orderdate}</ORDERDATE>
            <ORDERTIME>${ordertime}</ORDERTIME>
            <ORDERNUM>${ordernum}</ORDERNUM>
            <CASHDESKNUM>${cashdesknum}</CASHDESKNUM>
            <CASHREGISTERNUM>${cashregisternum}</CASHREGISTERNUM>
            <VER>1</VER>
        </CHECKHEAD>`
    return xml;
}

export function generate_shifts_open(uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier) {
    return generate_checkhead({
        doctype: 100
    }, uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier)
}

export function generate_shifts_close(uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier) {
    return generate_checkhead({
        doctype: 101
    }, uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier)
}

export function generate_service_input(uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, sum) {
    let xml = generate_checkhead({
        doctype: 0,
        docsubtype: 2
    }, uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier);

    xml += `<CHECKTOTAL>
                <SUM>${sum.toFixed(2)}</SUM>
            </CHECKTOTAL>`;
    return xml;
}

export function generate_service_output(uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, sum) {
    let xml = generate_checkhead({
        doctype: 0,
        docsubtype: 4
    }, uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier);

    xml += `<CHECKTOTAL>
                <SUM>${sum.toFixed(2)}</SUM>
            </CHECKTOTAL>`;
    return xml;
}