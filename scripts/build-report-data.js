const { writeReportArtifacts } = require('../reportDataBuilder');

try {
    const reportData = writeReportArtifacts();
    console.log('[REPORT] Da tao report-data.json thanh cong.');
    console.log(`[REPORT] Ky hien tai: thang ${reportData.current.month}/${reportData.current.year}`);
} catch (error) {
    console.error('[REPORT ERROR]', error.message);
    process.exit(1);
}
