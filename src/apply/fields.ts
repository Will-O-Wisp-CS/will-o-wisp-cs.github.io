/**
 * 会場のひな形と開催日から、申請の詳細画面（shopeventsub.asp）に入れる値を作る。
 * name は画面の input / select / textarea の name。時・分の select は2桁の文字列。
 */

export type Common = { entryFee: number; details: string; bringing: string; organizer: string; judges: number[] };
export type Venue = {
  name: string;
  reception: string;
  start: string;
  capacity: number;
  pref: number;
  address: string;
  tel: string;
  coordinate: 1 | 2 | 3;
  lat: string;
  lng: string;
  mapUrl: string;
  formatBiko: string;
  schedule: string;
  prize: string;
};
export type VenueFile = { common: Common; venues: Venue[] };
export type FormValues = {
  texts: Record<string, string>;
  selects: Record<string, string>;
  hidden: Record<string, string>;
  judges: number[];
};

const TWITTER_ID = '@Will_O_Wisp_CS';
/** 参加表明・デッキ提出の受付は開催日の14日前 20:00 から */
const ENTRY_START_DAYS = 14;
const ENTRY_START_TIME = 20 * 60;
/** 参加表明の締切は受付開始の10分前 */
const ENTRY_LIMIT_BEFORE_RECEPTION = 10;
/** デッキ提出の締切は開催日の 23:59 */
const DECK_LIMIT_TIME = 23 * 60 + 59;

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' + 分（負なら前の日へ繰り下げ）→ 画面の日付 'YYYY/MM/DD' と時・分 */
function dateTime(date: string, minutes: number, dayOffset = 0): { date: string; hour: string; minute: string } {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + dayOffset) + minutes * 60_000);
  return {
    date: `${at.getUTCFullYear()}/${pad(at.getUTCMonth() + 1)}/${pad(at.getUTCDate())}`,
    hour: pad(at.getUTCHours()),
    minute: pad(at.getUTCMinutes()),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function buildFields(file: VenueFile, venueName: string, date: string, mail: string): FormValues {
  const venue = file.venues.find((v) => v.name === venueName);
  if (!venue) throw new Error(`会場「${venueName}」のひな形がありません`);
  const { common } = file;
  const event = dateTime(date, 0);
  const reception = dateTime(date, toMinutes(venue.reception));
  const start = dateTime(date, toMinutes(venue.start));
  const entryStart = dateTime(date, ENTRY_START_TIME, -ENTRY_START_DAYS);
  const entryLimit = dateTime(date, toMinutes(venue.reception) - ENTRY_LIMIT_BEFORE_RECEPTION);
  const deckLimit = dateTime(date, DECK_LIMIT_TIME);

  return {
    texts: {
      EventName: `鬼火CS in ${venue.name}`,
      EventDate: event.date,
      EntryFee: String(common.entryFee),
      Capacity: String(venue.capacity),
      EntryStart: entryStart.date,
      EntryLimit: entryLimit.date,
      DeckStart: entryStart.date,
      DeckLimit: deckLimit.date,
      Venue: venue.name,
      Jusho: venue.address,
      MapURL: venue.mapUrl,
      Tel: venue.tel,
      TwitterID: TWITTER_ID,
      FormatBikoInput: venue.formatBiko,
      ScheduleInput: venue.schedule,
      PrizeInput: venue.prize,
      DetailsInput: common.details,
      BringingInput: common.bringing,
      MoushikomiInput: '',
      SubEventInput: '',
      Organizer: common.organizer,
      StuffInput: '',
      Mail: mail,
      HeadJudge: '',
      NotesInput: '',
    },
    selects: {
      ReceptionHour: reception.hour,
      ReceptionMinute: reception.minute,
      EventStartHour: start.hour,
      EventStartMinute: start.minute,
      EventTeam: '1',
      EventDendo: '6',
      EventFormat: '1',
      EntryStartHour: entryStart.hour,
      EntryStartMinute: entryStart.minute,
      EntryLimitHour: entryLimit.hour,
      EntryLimitMinute: entryLimit.minute,
      EntryOver: '1',
      DeckStartHour: entryStart.hour,
      DeckStartMinute: entryStart.minute,
      DeckLimitHour: deckLimit.hour,
      DeckLimitMinute: deckLimit.minute,
      DeckLimitEdit: '0',
      Pref: String(venue.pref),
      Coordinate: String(venue.coordinate),
    },
    hidden: venue.lat && venue.lng ? { Lat: venue.lat, Lng: venue.lng } : {},
    judges: [...common.judges],
  };
}
