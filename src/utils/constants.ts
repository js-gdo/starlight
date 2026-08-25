// 工单状态配置
export const TICKET_STATUSES: Record<string, { label: string; icon: string; color: string }> = {
    'pending': { label: '待处理', icon: 'fa-circle-ellipsis', color: '#f39c12' },
    'completed': { label: '已完成', icon: 'fa-circle-check', color: '#2ecc71' },
    'closed': { label: '已关闭', icon: 'fa-circle-x', color: '#e74c3c' },
    'suspended': { label: '挂起', icon: 'fa-circle-pause', color: '#9b59b6' },
    'waiting': { label: '待补充', icon: 'fa-circle-question', color: '#3498db' }
};

export function getTicketStatus(status: string) {
    return TICKET_STATUSES[status] || TICKET_STATUSES['pending'];
}

// 颜色映射
export const COLOR_MAP: Record<string, string> = {
    purple: '#8E44AD',
    red: '#E74C3C',
    orange: '#E67E22',
    green: '#5EB95E',
    blue: '#0E90D2',
    gray: '#BFBFBF'
};

export function getUserColor(color: string): string {
    return COLOR_MAP[color] || color || '#E74C3C';
}

// 中国省级行政区中文映射
export const REGION_CN_MAP: Record<string, string> = {
    'Beijing': '北京市', 'Tianjin': '天津市', 'Shanghai': '上海市', 'Chongqing': '重庆市',
    'Hebei': '河北省', 'Shanxi': '山西省', 'Liaoning': '辽宁省', 'Jilin': '吉林省',
    'Heilongjiang': '黑龙江省', 'Jiangsu': '江苏省', 'Zhejiang': '浙江省', 'Anhui': '安徽省',
    'Fujian': '福建省', 'Jiangxi': '江西省', 'Shandong': '山东省', 'Henan': '河南省',
    'Hubei': '湖北省', 'Hunan': '湖南省', 'Guangdong': '广东省', 'Hainan': '海南省',
    'Sichuan': '四川省', 'Guizhou': '贵州省', 'Yunnan': '云南省', 'Shaanxi': '陕西省',
    'Gansu': '甘肃省', 'Qinghai': '青海省', 'Taiwan': '台湾省',
    'Inner Mongolia': '内蒙古自治区', 'Guangxi': '广西壮族自治区', 'Tibet': '西藏自治区',
    'Ningxia': '宁夏回族自治区', 'Ningxia Hui': '宁夏回族自治区',
    'Xinjiang': '新疆维吾尔自治区', 'Xinjiang Uyghur': '新疆维吾尔自治区',
    'Hong Kong': '香港特别行政区', 'Macau': '澳门特别行政区', 'Macao': '澳门特别行政区'
};

export function regionToChinese(region: string): string {
    if (!region) return '';
    return REGION_CN_MAP[region] || region;
}