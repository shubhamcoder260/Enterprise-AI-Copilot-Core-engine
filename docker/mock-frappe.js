import http from 'http';

const DOCTYPES = {
  // ==========================================
  // ACCOUNTS / ACCOUNTING MODULE
  // ==========================================
  'Sales Invoice': {
    name: 'Sales Invoice',
    module: 'Accounts',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'customer', label: 'Customer', fieldtype: 'Link', options: 'Customer', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'due_date', label: 'Due Date', fieldtype: 'Date' },
      { fieldname: 'grand_total', label: 'Grand Total', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'net_total', label: 'Net Total', fieldtype: 'Currency' },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Draft\nReturn\nCredit Note Issued\nSubmitted\nPaid\nUnpaid\nOverdue\nCancelled' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'GL Entry': {
    name: 'GL Entry',
    module: 'Accounts',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'account', label: 'Account', fieldtype: 'Link', options: 'Account', reqd: 1 },
      { fieldname: 'debit', label: 'Debit', fieldtype: 'Currency' },
      { fieldname: 'credit', label: 'Credit', fieldtype: 'Currency' },
      { fieldname: 'voucher_type', label: 'Voucher Type', fieldtype: 'Data' },
      { fieldname: 'voucher_no', label: 'Voucher No', fieldtype: 'Data' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'Journal Entry': {
    name: 'Journal Entry',
    module: 'Accounts',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'voucher_type', label: 'Voucher Type', fieldtype: 'Select', options: 'Journal Entry\nInter Company Journal Entry\nBank Entry\nCash Entry' },
      { fieldname: 'total_debit', label: 'Total Debit', fieldtype: 'Currency' },
      { fieldname: 'total_credit', label: 'Total Credit', fieldtype: 'Currency' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'Payment Entry': {
    name: 'Payment Entry',
    module: 'Accounts',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'payment_type', label: 'Payment Type', fieldtype: 'Select', options: 'Receive\nPay\nInternal Transfer' },
      { fieldname: 'party_type', label: 'Party Type', fieldtype: 'Select', options: 'Customer\nSupplier\nEmployee' },
      { fieldname: 'party', label: 'Party', fieldtype: 'Dynamic Link', reqd: 1 },
      { fieldname: 'paid_amount', label: 'Paid Amount', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'received_amount', label: 'Received Amount', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },

  // ==========================================
  // SELLING MODULE
  // ==========================================
  'Customer': {
    name: 'Customer',
    module: 'Selling',
    istable: 0,
    issubmittable: 0,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'customer_name', label: 'Customer Name', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'customer_group', label: 'Customer Group', fieldtype: 'Link', options: 'Customer Group' },
      { fieldname: 'territory', label: 'Territory', fieldtype: 'Link', options: 'Territory' },
      { fieldname: 'disabled', label: 'Disabled', fieldtype: 'Check' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int' }
    ]
  },
  'Sales Order': {
    name: 'Sales Order',
    module: 'Selling',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'customer', label: 'Customer', fieldtype: 'Link', options: 'Customer', reqd: 1 },
      { fieldname: 'transaction_date', label: 'Order Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'delivery_date', label: 'Expected Delivery Date', fieldtype: 'Date' },
      { fieldname: 'grand_total', label: 'Grand Total', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Draft\nTo Deliver and Bill\nTo Bill\nTo Deliver\nCompleted\nCancelled\nClosed' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'Quotation': {
    name: 'Quotation',
    module: 'Selling',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'party_name', label: 'Party Name', fieldtype: 'Link', options: 'Customer', reqd: 1 },
      { fieldname: 'transaction_date', label: 'Quotation Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'grand_total', label: 'Grand Total', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Draft\nOpen\nReplied\nOrdered\nLost\nCancelled' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },

  // ==========================================
  // BUYING MODULE
  // ==========================================
  'Supplier': {
    name: 'Supplier',
    module: 'Buying',
    istable: 0,
    issubmittable: 0,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'supplier_name', label: 'Supplier Name', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'supplier_group', label: 'Supplier Group', fieldtype: 'Link', options: 'Supplier Group' },
      { fieldname: 'country', label: 'Country', fieldtype: 'Link', options: 'Country' },
      { fieldname: 'disabled', label: 'Disabled', fieldtype: 'Check' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int' }
    ]
  },
  'Purchase Order': {
    name: 'Purchase Order',
    module: 'Buying',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'supplier', label: 'Supplier', fieldtype: 'Link', options: 'Supplier', reqd: 1 },
      { fieldname: 'transaction_date', label: 'Order Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'grand_total', label: 'Grand Total', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Draft\nTo Receive and Bill\nTo Bill\nTo Receive\nCompleted\nCancelled\nClosed' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'Purchase Invoice': {
    name: 'Purchase Invoice',
    module: 'Buying',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'supplier', label: 'Supplier', fieldtype: 'Link', options: 'Supplier', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'due_date', label: 'Due Date', fieldtype: 'Date' },
      { fieldname: 'grand_total', label: 'Grand Total', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'net_total', label: 'Net Total', fieldtype: 'Currency' },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Draft\nReturn\nSubmitted\nPaid\nUnpaid\nOverdue\nCancelled' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },

  // ==========================================
  // STOCK MODULE
  // ==========================================
  'Item': {
    name: 'Item',
    module: 'Stock',
    istable: 0,
    issubmittable: 0,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'item_code', label: 'Item Code', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'item_name', label: 'Item Name', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'item_group', label: 'Item Group', fieldtype: 'Link', options: 'Item Group' },
      { fieldname: 'stock_uom', label: 'Default Unit of Measure', fieldtype: 'Link', options: 'UOM' },
      { fieldname: 'disabled', label: 'Disabled', fieldtype: 'Check' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int' }
    ]
  },
  'Stock Ledger Entry': {
    name: 'Stock Ledger Entry',
    module: 'Stock',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'item_code', label: 'Item Code', fieldtype: 'Link', options: 'Item', reqd: 1 },
      { fieldname: 'warehouse', label: 'Warehouse', fieldtype: 'Link', options: 'Warehouse', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'actual_qty', label: 'Quantity Change', fieldtype: 'Float' },
      { fieldname: 'qty_after_transaction', label: 'Balance Quantity', fieldtype: 'Float' },
      { fieldname: 'valuation_rate', label: 'Valuation Rate', fieldtype: 'Currency' },
      { fieldname: 'stock_value_difference', label: 'Stock Value Difference', fieldtype: 'Currency' },
      { fieldname: 'voucher_type', label: 'Voucher Type', fieldtype: 'Data' },
      { fieldname: 'voucher_no', label: 'Voucher No', fieldtype: 'Data' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'Delivery Note': {
    name: 'Delivery Note',
    module: 'Stock',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'customer', label: 'Customer', fieldtype: 'Link', options: 'Customer', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'grand_total', label: 'Grand Total', fieldtype: 'Currency' },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Draft\nTo Bill\nCompleted\nReturn Issued\nCancelled\nClosed' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },

  // ==========================================
  // HR MODULE
  // ==========================================
  'Employee': {
    name: 'Employee',
    module: 'HR',
    istable: 0,
    issubmittable: 0,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'employee_name', label: 'Employee Name', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'department', label: 'Department', fieldtype: 'Link', options: 'Department' },
      { fieldname: 'designation', label: 'Designation', fieldtype: 'Link', options: 'Designation' },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Active\nInactive\nSuspended\nLeft' },
      { fieldname: 'date_of_joining', label: 'Date of Joining', fieldtype: 'Date' },
      { fieldname: 'relieving_date', label: 'Date of Relieving', fieldtype: 'Date' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int' },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'Salary Slip': {
    name: 'Salary Slip',
    module: 'HR',
    istable: 0,
    issubmittable: 1,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'employee', label: 'Employee', fieldtype: 'Link', options: 'Employee', reqd: 1 },
      { fieldname: 'employee_name', label: 'Employee Name', fieldtype: 'Data' },
      { fieldname: 'start_date', label: 'Start Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'end_date', label: 'End Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'posting_date', label: 'Posting Date', fieldtype: 'Date', reqd: 1 },
      { fieldname: 'gross_pay', label: 'Gross Pay', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'net_pay', label: 'Net Pay', fieldtype: 'Currency', reqd: 1 },
      { fieldname: 'total_deduction', label: 'Total Deduction', fieldtype: 'Currency' },
      { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Draft\nSubmitted\nPaid\nCancelled' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int', reqd: 1 },
      { fieldname: 'company', label: 'Company', fieldtype: 'Link', options: 'Company' }
    ]
  },
  'Department': {
    name: 'Department',
    module: 'HR',
    istable: 0,
    issubmittable: 0,
    fields: [
      { fieldname: 'name', label: 'ID', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'department_name', label: 'Department Name', fieldtype: 'Data', reqd: 1 },
      { fieldname: 'parent_department', label: 'Parent Department', fieldtype: 'Link', options: 'Department' },
      { fieldname: 'disabled', label: 'Disabled', fieldtype: 'Check' },
      { fieldname: 'docstatus', label: 'Document Status', fieldtype: 'Int' }
    ]
  }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/api/method/frappe.desk.form.load.getdoctype') {
    const doctype = url.searchParams.get('doctype');
    const authHeader = req.headers['authorization'] || '';
    
    // Validate Token format: token api_key:api_secret or Bearer
    if (!authHeader.startsWith('token ') && !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ exc_type: 'AuthenticationError', message: 'Token required' }));
    }

    if (doctype && DOCTYPES[doctype]) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        message: {
          docs: [DOCTYPES[doctype]]
        }
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ exc_type: 'DoesNotExistError', message: `DocType ${doctype} not found` }));
    }
  }

  if (url.pathname === '/api/method/frappe.desk.form.load.list_doctypes') {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('token ') && !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ exc_type: 'AuthenticationError', message: 'Token required' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      message: Object.keys(DOCTYPES).map(name => ({
        name,
        module: DOCTYPES[name].module,
        issubmittable: DOCTYPES[name].issubmittable,
        istable: DOCTYPES[name].istable
      }))
    }));
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'frappe-bench-mock', doctypes_count: Object.keys(DOCTYPES).length }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Frappe bench mock listening on port ${PORT} (${Object.keys(DOCTYPES).length} doctypes loaded across 5 modules)`);
});
