import { getSessionUser, generateHex, jsonRes } from '../utils/auth';
import { getLayout } from '../utils/layout';
import { renderUsernameLink, htmlEscape } from '../utils/html';
import { formatTimeToChina, getChinaTime, getHitokoto } from '../utils/time';
import { getUserColor, getTicketStatus } from '../utils/constants';
import { generateFortune } from '../utils/fortune';
import { sendNotification, getSystemUnreadCount, getPmUnreadCount } from '../utils/notification';
import type { Env } from '../env.d';