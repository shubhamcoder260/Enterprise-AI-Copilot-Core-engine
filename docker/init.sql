-- Initialize ERPNext database fixture
CREATE DATABASE IF NOT EXISTS `_4e5d6a7b8c9d0e1f` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `_4e5d6a7b8c9d0e1f`;

-- 1. tabCustomer table
CREATE TABLE IF NOT EXISTS `tabCustomer` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `customer_name` varchar(140) NOT NULL,
  `customer_group` varchar(140) DEFAULT 'Commercial',
  `territory` varchar(140) DEFAULT 'All Territories',
  `disabled` int(1) NOT NULL DEFAULT 0,
  INDEX idx_disabled (`disabled`),
  INDEX idx_customer_name (`customer_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. tabSales Invoice table
CREATE TABLE IF NOT EXISTS `tabSales Invoice` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `customer` varchar(140) NOT NULL,
  `posting_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `grand_total` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `net_total` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `total_taxes_and_charges` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `status` varchar(140) DEFAULT 'Draft',
  `company` varchar(140) DEFAULT 'CogniCore Enterprise',
  INDEX idx_posting_date (`posting_date`),
  INDEX idx_customer (`customer`),
  INDEX idx_docstatus (`docstatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. tabSales Invoice Item table
CREATE TABLE IF NOT EXISTS `tabSales Invoice Item` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `parent` varchar(140) NOT NULL,
  `parenttype` varchar(140) NOT NULL DEFAULT 'Sales Invoice',
  `parentfield` varchar(140) NOT NULL DEFAULT 'items',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `item_code` varchar(140) NOT NULL,
  `item_name` varchar(140) DEFAULT NULL,
  `qty` decimal(21,9) NOT NULL DEFAULT 1.000000000,
  `rate` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `amount` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  INDEX idx_parent (`parent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. tabGL Entry table
CREATE TABLE IF NOT EXISTS `tabGL Entry` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `posting_date` date DEFAULT NULL,
  `account` varchar(140) NOT NULL,
  `debit` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `credit` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `voucher_type` varchar(140) DEFAULT 'Sales Invoice',
  `voucher_no` varchar(140) DEFAULT NULL,
  `docstatus` int(1) NOT NULL DEFAULT 1,
  INDEX idx_account (`account`),
  INDEX idx_voucher_no (`voucher_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Customers (5 active, 2 disabled) -> Total active = 5
INSERT INTO `tabCustomer` (`name`, `customer_name`, `customer_group`, `disabled`, `docstatus`) VALUES
('CUST-001', 'Acme Corp', 'Commercial', 0, 0),
('CUST-002', 'Global Tech Solutions', 'Non Profit', 0, 0),
('CUST-003', 'Starlight Logistics', 'Commercial', 0, 0),
('CUST-004', 'Apex Systems', 'Government', 0, 0),
('CUST-005', 'Zenith Retail', 'Individual', 0, 0),
('CUST-006', 'Defunct Alpha LLC', 'Commercial', 1, 0),
('CUST-007', 'Inactive Beta Inc', 'Commercial', 1, 0)
ON DUPLICATE KEY UPDATE `customer_name`=VALUES(`customer_name`);

-- Seed FY2024 Sales Invoices (posting_date in 2024, docstatus = 1 means Submitted)
-- Total Grand Total = 125,000 + 75,000 + 200,000 + 50,000 = 450,000.00
INSERT INTO `tabSales Invoice` (`name`, `customer`, `posting_date`, `grand_total`, `net_total`, `status`, `docstatus`) VALUES
('SINV-2024-001', 'CUST-001', '2024-03-15', 125000.000000000, 120000.000000000, 'Paid', 1),
('SINV-2024-002', 'CUST-002', '2024-06-20', 75000.000000000, 70000.000000000, 'Paid', 1),
('SINV-2024-003', 'CUST-003', '2024-09-10', 200000.000000000, 190000.000000000, 'Paid', 1),
('SINV-2024-004', 'CUST-004', '2024-11-05', 50000.000000000, 48000.000000000, 'Unpaid', 1),
('SINV-2024-DRAFT', 'CUST-005', '2024-12-01', 99000.000000000, 95000.000000000, 'Draft', 0),
('SINV-2023-001', 'CUST-001', '2023-05-15', 30000.000000000, 28000.000000000, 'Paid', 1)
ON DUPLICATE KEY UPDATE `grand_total`=VALUES(`grand_total`);

-- Seed GL Entry (matches FY2024 sales invoices: 450,000)
INSERT INTO `tabGL Entry` (`name`, `posting_date`, `account`, `debit`, `credit`, `voucher_type`, `voucher_no`, `docstatus`) VALUES
('GLE-2024-001', '2024-03-15', '4110 - Sales - CE', 0.000000000, 125000.000000000, 'Sales Invoice', 'SINV-2024-001', 1),
('GLE-2024-002', '2024-06-20', '4110 - Sales - CE', 0.000000000, 75000.000000000, 'Sales Invoice', 'SINV-2024-002', 1),
('GLE-2024-003', '2024-09-10', '4110 - Sales - CE', 0.000000000, 200000.000000000, 'Sales Invoice', 'SINV-2024-003', 1),
('GLE-2024-004', '2024-11-05', '4110 - Sales - CE', 0.000000000, 50000.000000000, 'Sales Invoice', 'SINV-2024-004', 1)
ON DUPLICATE KEY UPDATE `credit`=VALUES(`credit`);

-- Configure read-only user 'cognicore_ro'
CREATE USER IF NOT EXISTS 'cognicore_ro'@'172.28.%.%' IDENTIFIED BY 'cognicore_ro_password';
CREATE USER IF NOT EXISTS 'cognicore_ro'@'%' IDENTIFIED BY 'cognicore_ro_password';
CREATE USER IF NOT EXISTS 'cognicore_ro'@'localhost' IDENTIFIED BY 'cognicore_ro_password';

REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'cognicore_ro'@'172.28.%.%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'cognicore_ro'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'cognicore_ro'@'localhost';

GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'172.28.%.%';
GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'%';
GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'localhost';

FLUSH PRIVILEGES;
