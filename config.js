export const state = {
    currentUnit: '',
    allSheetsResults: [],
    lastTotalPerimeter: 0,
    userIpAddress: '未知 IP',
    parsedExcelData: [],
    excelHeaders: [],
    isThicknessVisible: false,
    hasCalculated: false,
    isDragMode: false,
    currentActiveSheetIndex: 0,
    draggedItemInfo: null,
    globalDimColorMap: {}
};

export const ALLOWED_IPS = ['116.241.16.128'];
export const PASSCODE = 'ab123456';
export const COLORS = ['#1e40af', '#16a34a', '#d97706', '#dc2626', '#4f46e5', '#0891b2', '#9333ea', '#059669', '#db2777', '#ca8a04', '#0d9488', '#7c3aed'];
