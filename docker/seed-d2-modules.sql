-- ============================================================
-- PHASE D2: MULTI-MODULE FIXTURES (ACCOUNTING, SELLING, BUYING, STOCK, HR)
-- Database: _4e5d6a7b8c9d0e1f
-- ============================================================

USE `_4e5d6a7b8c9d0e1f`;

-- 1. SELLING: tabSales Order
CREATE TABLE IF NOT EXISTS `tabSales Order` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `customer` varchar(140) NOT NULL,
  `transaction_date` date DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `grand_total` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `status` varchar(140) DEFAULT 'Draft',
  `company` varchar(140) DEFAULT 'CogniCore Enterprise',
  INDEX idx_customer (`customer`),
  INDEX idx_transaction_date (`transaction_date`),
  INDEX idx_docstatus (`docstatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabSales Order` (`name`, `customer`, `transaction_date`, `grand_total`, `status`, `docstatus`) VALUES
('SO-2024-001', 'CUST-001', '2024-03-10', 130000.000000000, 'Completed', 1),
('SO-2024-002', 'CUST-002', '2024-06-15', 80000.000000000, 'Completed', 1),
('SO-2024-003', 'CUST-003', '2024-09-01', 210000.000000000, 'Completed', 1),
('SO-2024-004', 'CUST-004', '2024-11-01', 60000.000000000, 'To Deliver and Bill', 1),
('SO-2024-DRAFT', 'CUST-005', '2024-12-05', 70000.000000000, 'Draft', 0),
('SO-2024-CANCELLED', 'CUST-001', '2024-12-10', 40000.000000000, 'Cancelled', 2)
ON DUPLICATE KEY UPDATE `grand_total`=VALUES(`grand_total`);

-- 2. BUYING: tabSupplier
CREATE TABLE IF NOT EXISTS `tabSupplier` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `supplier_name` varchar(140) NOT NULL,
  `supplier_group` varchar(140) DEFAULT 'Raw Materials',
  `country` varchar(140) DEFAULT 'United States',
  `disabled` int(1) NOT NULL DEFAULT 0,
  INDEX idx_disabled (`disabled`),
  INDEX idx_supplier_name (`supplier_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabSupplier` (`name`, `supplier_name`, `supplier_group`, `country`, `disabled`, `docstatus`) VALUES
('SUPP-001', 'Acme Industrial Parts', 'Raw Materials', 'United States', 0, 0),
('SUPP-002', 'Global Metal Works', 'Hardware', 'Germany', 0, 0),
('SUPP-003', 'Apex Electronics', 'Electrical', 'Japan', 0, 0),
('SUPP-004', 'Pacific Chemical Supply', 'Chemicals', 'United States', 0, 0),
('SUPP-005', 'Old Defunct Vendor', 'Services', 'United States', 1, 0)
ON DUPLICATE KEY UPDATE `supplier_name`=VALUES(`supplier_name`);

-- 3. BUYING: tabPurchase Invoice
CREATE TABLE IF NOT EXISTS `tabPurchase Invoice` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `supplier` varchar(140) NOT NULL,
  `posting_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `grand_total` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `net_total` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `status` varchar(140) DEFAULT 'Draft',
  `company` varchar(140) DEFAULT 'CogniCore Enterprise',
  INDEX idx_posting_date (`posting_date`),
  INDEX idx_supplier (`supplier`),
  INDEX idx_docstatus (`docstatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabPurchase Invoice` (`name`, `supplier`, `posting_date`, `grand_total`, `net_total`, `status`, `docstatus`) VALUES
('PINV-2024-001', 'SUPP-001', '2024-02-10', 90000.000000000, 85000.000000000, 'Paid', 1),
('PINV-2024-002', 'SUPP-002', '2024-05-12', 60000.000000000, 57000.000000000, 'Paid', 1),
('PINV-2024-003', 'SUPP-003', '2024-08-20', 85000.000000000, 80000.000000000, 'Paid', 1),
('PINV-2024-004', 'SUPP-004', '2024-10-15', 45000.000000000, 42000.000000000, 'Unpaid', 1),
('PINV-2024-DRAFT', 'SUPP-001', '2024-12-02', 30000.000000000, 28000.000000000, 'Draft', 0),
('PINV-2024-CANCELLED', 'SUPP-002', '2024-12-08', 15000.000000000, 14000.000000000, 'Cancelled', 2)
ON DUPLICATE KEY UPDATE `grand_total`=VALUES(`grand_total`);

-- 4. STOCK: tabItem
CREATE TABLE IF NOT EXISTS `tabItem` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `item_code` varchar(140) NOT NULL,
  `item_name` varchar(140) NOT NULL,
  `item_group` varchar(140) DEFAULT 'Products',
  `stock_uom` varchar(140) DEFAULT 'Nos',
  `disabled` int(1) NOT NULL DEFAULT 0,
  INDEX idx_item_code (`item_code`),
  INDEX idx_disabled (`disabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabItem` (`name`, `item_code`, `item_name`, `item_group`, `stock_uom`, `disabled`, `docstatus`) VALUES
('ITEM-001', 'ITM-001', 'High Precision Stepper Motor', 'Electronics', 'Nos', 0, 0),
('ITEM-002', 'ITM-002', 'Titanium Fastener 10mm', 'Hardware', 'Box', 0, 0),
('ITEM-003', 'ITM-003', 'Industrial Coolant 5L', 'Consumables', 'Can', 0, 0),
('ITEM-004', 'ITM-004', 'Reinforced Ceramic Bearing', 'Hardware', 'Nos', 0, 0),
('ITEM-005', 'ITM-005', 'Legacy Discontinued Sensor', 'Electronics', 'Nos', 1, 0)
ON DUPLICATE KEY UPDATE `item_name`=VALUES(`item_name`);

-- 5. STOCK: tabStock Ledger Entry
CREATE TABLE IF NOT EXISTS `tabStock Ledger Entry` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 1,
  `item_code` varchar(140) NOT NULL,
  `warehouse` varchar(140) DEFAULT 'Stores - CE',
  `posting_date` date DEFAULT NULL,
  `actual_qty` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `qty_after_transaction` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `valuation_rate` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `stock_value_difference` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `voucher_type` varchar(140) DEFAULT 'Stock Entry',
  `voucher_no` varchar(140) DEFAULT NULL,
  `company` varchar(140) DEFAULT 'CogniCore Enterprise',
  INDEX idx_item_code (`item_code`),
  INDEX idx_posting_date (`posting_date`),
  INDEX idx_docstatus (`docstatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabStock Ledger Entry` (`name`, `item_code`, `warehouse`, `posting_date`, `actual_qty`, `qty_after_transaction`, `valuation_rate`, `stock_value_difference`, `docstatus`) VALUES
('SLE-2024-001', 'ITEM-001', 'Stores - CE', '2024-03-01', 100.000000000, 100.000000000, 450.000000000, 45000.000000000, 1),
('SLE-2024-002', 'ITEM-002', 'Stores - CE', '2024-05-15', 200.000000000, 200.000000000, 150.000000000, 30000.000000000, 1),
('SLE-2024-003', 'ITEM-003', 'Stores - CE', '2024-07-20', 50.000000000, 50.000000000, 500.000000000, 25000.000000000, 1),
('SLE-2024-004', 'ITEM-004', 'Stores - CE', '2024-09-10', 100.000000000, 100.000000000, 500.000000000, 50000.000000000, 1)
ON DUPLICATE KEY UPDATE `stock_value_difference`=VALUES(`stock_value_difference`);

-- 6. HR: tabDepartment
CREATE TABLE IF NOT EXISTS `tabDepartment` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `department_name` varchar(140) NOT NULL,
  `parent_department` varchar(140) DEFAULT NULL,
  `disabled` int(1) NOT NULL DEFAULT 0,
  INDEX idx_disabled (`disabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabDepartment` (`name`, `department_name`, `disabled`, `docstatus`) VALUES
('DEP-001', 'Executive', 0, 0),
('DEP-002', 'Engineering', 0, 0),
('DEP-003', 'Sales & Marketing', 0, 0),
('DEP-004', 'Operations', 0, 0)
ON DUPLICATE KEY UPDATE `department_name`=VALUES(`department_name`);

-- 7. HR: tabEmployee
CREATE TABLE IF NOT EXISTS `tabEmployee` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `employee_name` varchar(140) NOT NULL,
  `department` varchar(140) DEFAULT 'Engineering',
  `designation` varchar(140) DEFAULT 'Staff',
  `status` varchar(140) DEFAULT 'Active',
  `date_of_joining` date DEFAULT NULL,
  `relieving_date` date DEFAULT NULL,
  `company` varchar(140) DEFAULT 'CogniCore Enterprise',
  INDEX idx_department (`department`),
  INDEX idx_status (`status`),
  INDEX idx_designation (`designation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabEmployee` (`name`, `employee_name`, `department`, `designation`, `status`, `date_of_joining`, `docstatus`) VALUES
('EMP-001', 'Victoria Stirling', 'Executive', 'Chief Executive Officer', 'Active', '2020-01-01', 0),
('EMP-002', 'Devon Vance', 'Engineering', 'Lead Systems Architect', 'Active', '2021-03-15', 0),
('EMP-003', 'Elena Rostova', 'Engineering', 'Senior Database Engineer', 'Active', '2022-06-01', 0),
('EMP-004', 'Marcus Brody', 'Sales & Marketing', 'VP of Enterprise Sales', 'Active', '2021-08-10', 0),
('EMP-005', 'Aisha Khan', 'Operations', 'Head of Supply Chain', 'Active', '2022-01-15', 0),
('EMP-006', 'Liam Chen', 'Engineering', 'DevOps Specialist', 'Active', '2023-04-01', 0),
('EMP-007', 'Former Intern', 'Engineering', 'Junior Analyst', 'Left', '2023-01-01', 0)
ON DUPLICATE KEY UPDATE `employee_name`=VALUES(`employee_name`);

-- 8. HR: tabSalary Slip
CREATE TABLE IF NOT EXISTS `tabSalary Slip` (
  `name` varchar(140) NOT NULL PRIMARY KEY,
  `creation` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `modified` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `modified_by` varchar(140) DEFAULT 'Administrator',
  `owner` varchar(140) DEFAULT 'Administrator',
  `docstatus` int(1) NOT NULL DEFAULT 0,
  `employee` varchar(140) NOT NULL,
  `employee_name` varchar(140) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `posting_date` date DEFAULT NULL,
  `gross_pay` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `net_pay` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `total_deduction` decimal(21,9) NOT NULL DEFAULT 0.000000000,
  `status` varchar(140) DEFAULT 'Draft',
  `company` varchar(140) DEFAULT 'CogniCore Enterprise',
  INDEX idx_employee (`employee`),
  INDEX idx_posting_date (`posting_date`),
  INDEX idx_docstatus (`docstatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `tabSalary Slip` (`name`, `employee`, `employee_name`, `start_date`, `end_date`, `posting_date`, `gross_pay`, `net_pay`, `status`, `docstatus`) VALUES
('SAL-2024-001', 'EMP-001', 'Victoria Stirling', '2024-11-01', '2024-11-30', '2024-11-30', 30000.000000000, 22000.000000000, 'Paid', 1),
('SAL-2024-002', 'EMP-002', 'Devon Vance', '2024-11-01', '2024-11-30', '2024-11-30', 14000.000000000, 11000.000000000, 'Paid', 1),
('SAL-2024-003', 'EMP-003', 'Elena Rostova', '2024-11-01', '2024-11-30', '2024-11-30', 13000.000000000, 10200.000000000, 'Paid', 1),
('SAL-2024-004', 'EMP-004', 'Marcus Brody', '2024-11-01', '2024-11-30', '2024-11-30', 12000.000000000, 9500.000000000, 'Paid', 1),
('SAL-2024-005', 'EMP-005', 'Aisha Khan', '2024-11-01', '2024-11-30', '2024-11-30', 9000.000000000, 7200.000000000, 'Paid', 1),
('SAL-2024-006', 'EMP-006', 'Liam Chen', '2024-11-01', '2024-11-30', '2024-11-30', 7000.000000000, 5600.000000000, 'Paid', 1),
('SAL-2024-DRAFT', 'EMP-002', 'Devon Vance', '2024-12-01', '2024-12-31', '2024-12-31', 14000.000000000, 11000.000000000, 'Draft', 0),
('SAL-2024-CANCELLED', 'EMP-003', 'Elena Rostova', '2024-12-01', '2024-12-31', '2024-12-31', 13000.000000000, 10200.000000000, 'Cancelled', 2)
ON DUPLICATE KEY UPDATE `gross_pay`=VALUES(`gross_pay`);

-- Ensure read-only permissions apply to all newly created tables
GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'172.28.%.%';
GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'%';
GRANT SELECT ON `_4e5d6a7b8c9d0e1f`.* TO 'cognicore_ro'@'localhost';
FLUSH PRIVILEGES;
