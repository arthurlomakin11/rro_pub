let xmlescape = require('xml-escape');

function generate_product_sell(uid, tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, checktotal_sum, payments, taxes, products, discount, returnReceipt, returnReceiptNumber) {
    let xml = `
        <CHECKHEAD>
            <DOCTYPE>0</DOCTYPE>`;
    if(returnReceipt) {
        xml += `<DOCSUBTYPE>1</DOCSUBTYPE>`
    }
    xml += `<UID>${uid}</UID>
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
            <CASHREGISTERNUM>${cashregisternum}</CASHREGISTERNUM>`;
    if(returnReceiptNumber) {
        xml += `<ORDERRETNUM>${returnReceiptNumber}</ORDERRETNUM>`;
    }
    xml += `<VER>1</VER>
        </CHECKHEAD>`;
    xml +=  `<CHECKTOTAL>
        <SUM>${checktotal_sum.toFixed(2)}</SUM>`;
    if(discount) {
        xml += `<DISCOUNTTYPE>${discount.discountType}</DISCOUNTTYPE>`;
        if(discount.discountPercent) {
            xml += `<DISCOUNTPERCENT>${discount.discountPercent.toFixed(2)}</DISCOUNTPERCENT>`;
        }
        xml += `<DISCOUNTSUM>${discount.discountSum.toFixed(2)}</DISCOUNTSUM>`
    }
    xml += `</CHECKTOTAL>`;

    let payments_xml = "";
    if (payments.length > 0) {
        payments.forEach((payment, number) => {
            payments_xml += `<ROW ROWNUM="${number + 1}">
                        <PAYFORMCD>${payment.paymentTypeCode}</PAYFORMCD>
                        <PAYFORMNM>${payment.paymentTypeName}</PAYFORMNM>
                        <SUM>${payment.sumString}</SUM>
                        <PROVIDED>${payment.providedString}</PROVIDED>
                        <REMAINS>${payment.remainsString}</REMAINS>
                    </ROW>`;
        })
        payments_xml = `<CHECKPAY>${payments_xml}</CHECKPAY>`;
    }


    let taxes_xml = "";
    if(taxes.length > 0) {
        taxes.forEach((tax, number) => {
            taxes_xml += `
                    <ROW ROWNUM="${number + 1}">
                        <TYPE>${tax.taxCode}</TYPE>                        
                        <NAME>${tax.taxName}</NAME>
                        <LETTER>${tax.taxLetter}</LETTER>
                        <PRC>${tax.taxPercent}</PRC>
                        <SIGN>false</SIGN>
                        <TURNOVER>${tax.turnover}</TURNOVER>
                        <SUM>${tax.sum}</SUM>
                    </ROW>`;
        })
        taxes_xml = `<CHECKTAX>${taxes_xml}</CHECKTAX>`;
    }

    let sales_xml = "";
    products.forEach((product, number) => {
        sales_xml += `<ROW ROWNUM="${number + 1}">
            <CODE>${product.internalCode}</CODE>`

        if(product.uktzed) {
            sales_xml += `<UKTZED>${product.uktzed}</UKTZED>`;
        }

        sales_xml += `
            <NAME>${xmlescape(product.product_name)}</NAME>            
            <UNITCD>${product.unitCode}</UNITCD>
            <UNITNM>${product.unitName}</UNITNM>
            <AMOUNT>${product.quantity.toFixed(3)}</AMOUNT>
            <PRICE>${product.price.toFixed(2)}</PRICE>`

        if(product.taxLetters) {
            sales_xml += `<LETTERS>${product.taxLetters}</LETTERS>`
        }

        sales_xml += `<COST>${product.sum.toFixed(2)}</COST>`;

        if(product.exciseLabels) {
            sales_xml += `<EXCISELABELS>`

            product.exciseLabels.forEach((label, index) => {
                sales_xml += `<ROW ROWNUM="${index + 1}">
                        <EXCISELABEL>${label.exciseLabel}</EXCISELABEL>
                    </ROW>`
            });

            sales_xml += `</EXCISELABELS>`
        }

        sales_xml += `</ROW>`;
    });
    sales_xml = `<CHECKBODY>${sales_xml}</CHECKBODY>`;

    xml += payments_xml;
    xml += taxes_xml;
    xml += sales_xml;

    return xml;
}

export default generate_product_sell;