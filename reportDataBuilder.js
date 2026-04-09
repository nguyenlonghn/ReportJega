const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const REPORT_ROOT = path.join(__dirname, 'Report');
const DEFAULT_METRICS = Object.freeze({
    totalLeads: 0,
    newLeads: 0,
    demoLeads: 0,
    totalRevenue: 0,
    ordersCompleted: 0,
    paidRevenue: 0,
    pendingRevenue: 0
});

function cloneDefaultMetrics() {
    return { ...DEFAULT_METRICS };
}

function cloneDefaultMonthData() {
    return {
        ...cloneDefaultMetrics(),
        leadBySource: [],
        leadByOwner: [],
        leadByRelation: [],
        leadOwnerStats: [],
        recentOrders: [],
        leadRecords: [],
        orderRecords: []
    };
}

function toNumber(value) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).trim().replace(/[^\d.-]/g, '');
    if (!cleaned) return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function parseViDate(value) {
    if (!value) return null;
    const match = String(value).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (!day || !month || !year) return null;

    return { day, month, year };
}

function parseViDateTime(value) {
    if (!value) return null;
    const match = String(value).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    if (!day || !month || !year) return null;

    return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function parseCsvFile(filePath) {
    if (!fs.existsSync(filePath)) return [];

    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) return [];

    return parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        bom: true,
        trim: true
    });
}

function normalizeForMatch(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function findCsvFileByPattern(dirPath, matcher) {
    if (!fs.existsSync(dirPath)) return null;

    const fileName = fs.readdirSync(dirPath)
        .filter((name) => /\.csv$/i.test(name))
        .find((name) => matcher(normalizeForMatch(name), name));

    return fileName ? path.join(dirPath, fileName) : null;
}

function resolveReportCsvPaths(monthPath) {
    const dskhPath =
        findCsvFileByPattern(monthPath, (normalized) => normalized.includes('danhsachkhachhang')) ||
        findCsvFileByPattern(monthPath, (normalized) => normalized.includes('danhsach') && normalized.includes('khachhang')) ||
        findCsvFileByPattern(monthPath, (normalized) => normalized === 'dskhcsv' || normalized === 'dskh') ||
        path.join(monthPath, 'dskh.csv');

    const dbhPath =
        findCsvFileByPattern(monthPath, (normalized) => normalized.includes('donhangban')) ||
        findCsvFileByPattern(monthPath, (normalized) => normalized.includes('donhang') && normalized.includes('ban')) ||
        findCsvFileByPattern(monthPath, (normalized) => normalized === 'dbhcsv' || normalized === 'dbh') ||
        path.join(monthPath, 'dbh.csv');

    return { dskhPath, dbhPath };
}

function getNumericFolderNames(dirPath) {
    if (!fs.existsSync(dirPath)) return [];

    return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map((entry) => Number(entry.name))
        .sort((a, b) => a - b);
}

function normalizeLabel(value, fallback = 'Khac') {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized || fallback;
}

function incrementCounter(counter, key, amount = 1) {
    counter[key] = (counter[key] || 0) + amount;
}

function toSortedEntries(counter, limit = 10) {
    return Object.entries(counter)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

function getInitials(name) {
    const parts = normalizeLabel(name).split(' ').filter(Boolean);
    if (!parts.length) return 'NA';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function buildMonthMetricsFromRows(year, month, dskhRows, dbhRows) {
    const leadRowsInMonth = dskhRows.filter((row) => {
        const createdAt = parseViDate(row['Ngày tạo']);
        return createdAt && createdAt.year === year && createdAt.month === month;
    });

    const orderRowsInMonth = dbhRows.filter((row) => {
        const createdAt = parseViDate(row['Ngày tạo']);
        return createdAt && createdAt.year === year && createdAt.month === month;
    });

    const leadRecords = [];
    const orderRecords = [];
    const sourceCounter = {};
    const ownerCounter = {};
    const relationCounter = {};
    const ownerDetails = {};

    for (const row of leadRowsInMonth) {
        const createdAtObj = parseViDate(row['Ngày tạo']);
        const source = normalizeLabel(row['Nguồn khách hàng']);
        const owner = normalizeLabel(row['Người phụ trách']);
        const relation = normalizeLabel(row['Mối quan hệ']);

        leadRecords.push({
            createdAt: normalizeLabel(row['Ngày tạo'], '-'),
            year,
            month,
            day: createdAtObj ? createdAtObj.day : 0,
            source,
            owner,
            relation
        });

        incrementCounter(sourceCounter, source);
        incrementCounter(ownerCounter, owner);
        incrementCounter(relationCounter, relation);

        if (!ownerDetails[owner]) {
            ownerDetails[owner] = {
                count: 0,
                sources: {},
                relations: {}
            };
        }

        ownerDetails[owner].count += 1;
        incrementCounter(ownerDetails[owner].sources, source);
        incrementCounter(ownerDetails[owner].relations, relation);
    }

    const totalLeads = leadRowsInMonth.length;
    const newLeads = leadRowsInMonth.filter((row) => {
        const relation = String(row['Mối quan hệ'] || '').toLowerCase();
        return relation.includes('moi') || relation.includes('mới') || relation.includes('lien he lan 1') || relation.includes('liên hệ lần 1');
    }).length || totalLeads;

    const demoLeads = leadRowsInMonth.filter((row) => {
        const relation = String(row['Mối quan hệ'] || '').toLowerCase();
        return relation.includes('demo');
    }).length;

    const ordersCompleted = orderRowsInMonth.filter((row) => {
        const status = String(row['Trạng thái đơn'] || '').toLowerCase();
        return status.includes('đã duyệt');
    }).length;

    const totalRevenue = orderRowsInMonth.reduce((sum, row) => {
        return sum + toNumber(row['Doanh thu']);
    }, 0);

    const paidRevenue = orderRowsInMonth.reduce((sum, row) => {
        return sum + toNumber(row['Đã thanh toán']);
    }, 0);

    const pendingRevenueRaw = orderRowsInMonth.reduce((sum, row) => {
        return sum + toNumber(row['Còn lại']);
    }, 0);
    const pendingRevenue = pendingRevenueRaw > 0 ? pendingRevenueRaw : Math.max(totalRevenue - paidRevenue, 0);

    const recentOrders = orderRowsInMonth
        .map((row) => {
            const createdRaw = row['Ngày tạo'] || row['Ngày đặt hàng'] || '';
            const createdDate = parseViDateTime(createdRaw);
            const createdDateOnly = parseViDate(createdRaw);
            const paid = toNumber(row['Đã thanh toán']);
            const pendingRaw = toNumber(row['Còn lại']);
            const revenue = toNumber(row['Doanh thu']);
            const pending = pendingRaw > 0 ? pendingRaw : Math.max(revenue - paid, 0);

            const normalizedRecord = {
                code: normalizeLabel(row['Mã ĐH'], '-'),
                customer: normalizeLabel(row['Tên KH'], 'Khach hang'),
                owner: normalizeLabel(row['Người thực hiện'], 'Chua ro'),
                revenue,
                paid,
                pending,
                status: normalizeLabel(row['Trạng thái đơn'], 'Khong ro'),
                createdAt: normalizeLabel(createdRaw, '-'),
                year,
                month,
                day: createdDateOnly ? createdDateOnly.day : 0,
                createdAtTs: createdDate ? createdDate.getTime() : 0
            };

            orderRecords.push(normalizedRecord);

            return {
                ...normalizedRecord
            };
        })
        .sort((a, b) => b.createdAtTs - a.createdAtTs)
        .slice(0, 10)
        .map(({ createdAtTs, ...order }) => order);

    const leadOwnerStats = Object.entries(ownerDetails)
        .map(([owner, detail]) => {
            const topSource = toSortedEntries(detail.sources, 1)[0]?.name || 'Khac';
            const topRelation = toSortedEntries(detail.relations, 1)[0]?.name || 'Quan tam';
            return {
                name: owner,
                count: detail.count,
                initials: getInitials(owner),
                topSource,
                topRelation
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        totalLeads,
        newLeads,
        demoLeads,
        totalRevenue,
        ordersCompleted,
        paidRevenue,
        pendingRevenue,
        leadBySource: toSortedEntries(sourceCounter, 8),
        leadByOwner: toSortedEntries(ownerCounter, 10),
        leadByRelation: toSortedEntries(relationCounter, 8),
        leadOwnerStats,
        recentOrders,
        leadRecords,
        orderRecords: orderRecords.map(({ createdAtTs, ...order }) => order)
    };
}

function buildMonthMetrics(year, month) {
    const monthPath = path.join(REPORT_ROOT, String(year), String(month));
    const { dskhPath, dbhPath } = resolveReportCsvPaths(monthPath);
    const dskhRows = parseCsvFile(dskhPath);
    const dbhRows = parseCsvFile(dbhPath);
    return buildMonthMetricsFromRows(year, month, dskhRows, dbhRows);
}

function buildReportData() {
    const years = getNumericFolderNames(REPORT_ROOT);
    const result = {
        generatedAt: new Date().toISOString(),
        years: {}
    };

    for (const year of years) {
        const yearPath = path.join(REPORT_ROOT, String(year));
        const monthFolders = new Set(getNumericFolderNames(path.join(REPORT_ROOT, String(year))));
        const { dskhPath: yearDskhPath, dbhPath: yearDbhPath } = resolveReportCsvPaths(yearPath);
        const yearDskhRows = parseCsvFile(yearDskhPath);
        const yearDbhRows = parseCsvFile(yearDbhPath);
        const hasYearLevelCsv = yearDskhRows.length > 0 || yearDbhRows.length > 0;

        const months = {};
        const yearLeadRecords = [];
        const yearOrderRecords = [];

        for (let month = 1; month <= 12; month += 1) {
            if (hasYearLevelCsv) {
                // Prefer one-file-per-year model and slice by month using Ngay tao.
                months[String(month)] = buildMonthMetricsFromRows(year, month, yearDskhRows, yearDbhRows);
            } else {
                months[String(month)] = monthFolders.has(month)
                    ? buildMonthMetrics(year, month)
                    : cloneDefaultMonthData();
            }
        }

        const monthly = Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            yearLeadRecords.push(...months[String(month)].leadRecords);
            yearOrderRecords.push(...months[String(month)].orderRecords);
            return {
                month,
                totalLeads: months[String(month)].totalLeads,
                newLeads: months[String(month)].newLeads,
                demoLeads: months[String(month)].demoLeads,
                totalRevenue: months[String(month)].totalRevenue,
                ordersCompleted: months[String(month)].ordersCompleted,
                paidRevenue: months[String(month)].paidRevenue,
                pendingRevenue: months[String(month)].pendingRevenue
            };
        });

        const summary = monthly.reduce((acc, monthData) => {
            acc.totalLeads += monthData.totalLeads;
            acc.newLeads += monthData.newLeads;
            acc.demoLeads += monthData.demoLeads;
            acc.totalRevenue += monthData.totalRevenue;
            acc.ordersCompleted += monthData.ordersCompleted;
            acc.paidRevenue += monthData.paidRevenue;
            acc.pendingRevenue += monthData.pendingRevenue;
            return acc;
        }, cloneDefaultMetrics());

        result.years[String(year)] = {
            months,
            monthly,
            summary,
            records: {
                leads: yearLeadRecords,
                orders: yearOrderRecords
            }
        };
    }

    const fallbackYear = new Date().getFullYear();
    const currentYear = years.length ? Math.max(...years) : fallbackYear;
    const currentYearData = result.years[String(currentYear)] || {
        months: Object.fromEntries(Array.from({ length: 12 }, (_, idx) => [String(idx + 1), cloneDefaultMonthData()])),
        monthly: Array.from({ length: 12 }, (_, idx) => ({ month: idx + 1, ...cloneDefaultMetrics() })),
        summary: cloneDefaultMetrics()
    };

    const currentMonth = currentYearData.monthly.reduce((latestMonth, monthData) => {
        const hasData = monthData.totalLeads > 0 || monthData.totalRevenue > 0 || monthData.ordersCompleted > 0;
        return hasData ? monthData.month : latestMonth;
    }, 0) || new Date().getMonth() + 1;

    const currentMonthData = currentYearData.months[String(currentMonth)] || cloneDefaultMonthData();
    const currentMetrics = {
        totalLeads: currentMonthData.totalLeads,
        newLeads: currentMonthData.newLeads,
        demoLeads: currentMonthData.demoLeads,
        totalRevenue: currentMonthData.totalRevenue,
        ordersCompleted: currentMonthData.ordersCompleted,
        paidRevenue: currentMonthData.paidRevenue,
        pendingRevenue: currentMonthData.pendingRevenue
    };

    result.current = {
        year: currentYear,
        month: currentMonth,
        metrics: currentMetrics,
        monthData: currentMonthData
    };

    return result;
}

function writeReportArtifacts() {
    const reportData = buildReportData();
    const jsonPath = path.join(__dirname, 'report-data.json');

    const reportJsonContent = JSON.stringify(reportData, null, 2);
    fs.writeFileSync(jsonPath, reportJsonContent, 'utf8');
    return reportData;
}

module.exports = {
    buildReportData,
    writeReportArtifacts
};
