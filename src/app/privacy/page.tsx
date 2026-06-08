'use client';

import Link from 'next/link';

export default function Privacy() {
  return (
    <div className="min-h-screen" style={{ background: '#FAF9F6' }}>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-[#FC4C02] hover:opacity-80 uppercase tracking-wider text-sm mb-6 inline-block"
          >
            ← BACK TO RECEIPTS
          </Link>
          <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">
            PRIVACY POLICY
          </h1>
          <p className="text-[10px] text-[#999] uppercase tracking-wider">
            LAST UPDATED: JUNE 8, 2026
          </p>
        </div>

        <div className="space-y-10 mb-12">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              THE SHORT VERSION
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              STRAVA RECEIPT TURNS YOUR STRAVA ACTIVITIES INTO RECEIPT-STYLE IMAGES.
              YOUR DATA IS STREAMED DIRECTLY FROM THE STRAVA API TO YOUR BROWSER AND
              RENDERED ON YOUR DEVICE. WE DO NOT RUN A DATABASE, WE DO NOT STORE YOUR
              ACTIVITIES ON OUR SERVERS, AND WE NEVER SELL OR SHARE YOUR DATA.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              WHAT DATA WE ACCESS
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666] mb-3">
              WHEN YOU CONNECT YOUR STRAVA ACCOUNT, YOU GRANT READ ACCESS TO YOUR
              ACTIVITIES (THE <span className="font-bold">ACTIVITY:READ_ALL</span> SCOPE,
              WHICH INCLUDES ACTIVITIES YOU HAVE MARKED PRIVATE). WE READ ONLY WHAT IS
              NEEDED TO BUILD A RECEIPT, INCLUDING:
            </p>
            <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
              <li>ACTIVITY NAME, TYPE, DATE AND DESCRIPTION</li>
              <li>DISTANCE, TIME, PACE/SPEED, ELEVATION AND HEART RATE</li>
              <li>GPS ROUTE DATA (POLYLINE) AND START LOCATION</li>
              <li>GEAR INFO AND ACHIEVEMENTS (PRS/KOMS)</li>
              <li>ACTIVITY PHOTOS</li>
              <li>YOUR STRAVA OAUTH TOKENS (TO STAY CONNECTED)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              WHERE YOUR DATA LIVES
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              YOUR ACCESS TOKENS AND A CACHE OF YOUR RECENT ACTIVITIES ARE STORED IN
              YOUR BROWSER&apos;S LOCAL STORAGE ON YOUR OWN DEVICE. THIS LETS THE APP LOAD
              FASTER AND AVOID REPEATED CALLS TO STRAVA. THIS DATA NEVER LEAVES YOUR
              DEVICE EXCEPT TO TALK TO STRAVA. YOU CAN CLEAR IT AT ANY TIME BY
              DISCONNECTING (SEE BELOW) OR CLEARING YOUR BROWSER STORAGE.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              THIRD PARTIES
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666] mb-3">
              STRAVA NO LONGER RELIABLY RETURNS A CITY/STATE NAME FOR ACTIVITIES, SO
              TO LABEL WHERE AN ACTIVITY HAPPENED THE APP MAY SEND ONLY THAT
              ACTIVITY&apos;S START COORDINATES TO THE OPENSTREETMAP NOMINATIM SERVICE
              TO LOOK UP A CITY, STATE AND COUNTRY. NO OTHER STRAVA DATA AND NO
              PERSONAL IDENTIFIERS ARE SENT. ACTIVITY PHOTOS ARE LOADED THROUGH A
              SERVER-SIDE IMAGE PROXY SO THEY CAN BE DRAWN ONTO THE RECEIPT; PROXIED
              IMAGES ARE NOT RETAINED.
            </p>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              THE APP IS HOSTED ON VERCEL, WHICH MAY PROCESS STANDARD REQUEST LOGS AS
              PART OF SERVING THE SITE.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              HOW YOUR DATA IS USED
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              YOUR DATA IS USED ONLY TO RENDER, DOWNLOAD, OR PRINT YOUR RECEIPTS. WE DO
              NOT USE IT FOR ADVERTISING, WE DO NOT BUILD PROFILES, AND WE DO NOT SHARE
              IT WITH ANY THIRD PARTY EXCEPT AS DESCRIBED ABOVE.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              DISCONNECTING & DELETING
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              USE THE DISCONNECT BUTTON IN THE APP TO REMOVE YOUR TOKENS AND CACHED
              ACTIVITIES FROM YOUR BROWSER. YOU CAN ALSO REVOKE THIS APP&apos;S ACCESS AT
              ANY TIME FROM YOUR STRAVA SETTINGS AT{' '}
              <a
                href="https://www.strava.com/settings/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FC4C02] hover:underline"
              >
                STRAVA.COM/SETTINGS/APPS
              </a>
              . BECAUSE WE DO NOT STORE YOUR DATA ON A SERVER, THERE IS NOTHING FURTHER
              FOR US TO DELETE.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              STRAVA&apos;S TERMS
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              THIS APP USES THE STRAVA API BUT IS NOT ENDORSED OR CERTIFIED BY STRAVA.
              YOUR USE OF STRAVA DATA IS ALSO GOVERNED BY STRAVA&apos;S OWN PRIVACY POLICY
              AND TERMS.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              CONTACT
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              QUESTIONS ABOUT PRIVACY? EMAIL{' '}
              <a href="mailto:pete@ngenart.com" className="text-[#FC4C02] hover:underline">
                PETE@NGENART.COM
              </a>
              {' '}OR VISIT THE{' '}
              <Link href="/support" className="text-[#FC4C02] hover:underline">
                SUPPORT PAGE
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-[#DDD]">
          <p className="text-[10px] text-[#999] uppercase tracking-wider">
            <Link href="https://repete.art" className="hover:text-[#FC4C02]">
              BUILT WITH LOVE BY PETE :D
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
