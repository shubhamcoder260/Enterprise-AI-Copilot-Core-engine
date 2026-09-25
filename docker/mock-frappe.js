import http from 'http';

const DOCTYPES = {
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
  }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/api/method/frappe.desk.form.load.getdoctype') {
    const doctype = url.searchParams.get('doctype');
    const authHeader = req.headers['authorization'] || '';
    
    // Validate Token format: token api_key:api_secret
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

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'frappe-bench-mock' }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Frappe bench mock listening on port ${PORT}`);
});
