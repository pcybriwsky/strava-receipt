'use client';

import Link from 'next/link';

export default function Support() {
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
          <h1 className="text-3xl font-bold uppercase tracking-wider mb-8">
            SUPPORT
          </h1>
        </div>

        {/* Contact */}
        <div className="mb-12">
          <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
            GET IN TOUCH
          </h2>
          <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666] mb-4">
            NEED HELP, FOUND A BUG, OR HAVE A FEATURE REQUEST? THE FASTEST WAY TO
            REACH ME IS EMAIL. I AIM TO RESPOND WITHIN 2-3 BUSINESS DAYS.
          </p>
          <ul className="space-y-2 text-sm leading-relaxed uppercase tracking-wider text-[#666] list-disc list-inside">
            <li>
              EMAIL:{' '}
              <a href="mailto:pete@ngenart.com" className="text-[#FC4C02] hover:underline">
                PETE@NGENART.COM
              </a>
            </li>
            <li>
              INSTAGRAM DM:{' '}
              <a
                href="https://www.instagram.com/_re_pete"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FC4C02] hover:underline"
              >
                @_RE_PETE
              </a>
            </li>
          </ul>
        </div>

        {/* FAQ / Common topics */}
        <div className="space-y-10 mb-12">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              HOW DO I CONNECT MY STRAVA?
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              FROM THE HOME PAGE, TAP &quot;CONNECT WITH STRAVA&quot; AND AUTHORIZE THE APP.
              YOU&apos;LL BE RETURNED TO STRAVA RECEIPT WITH YOUR ACTIVITIES LOADED.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              HOW DO I DISCONNECT OR REVOKE ACCESS?
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              USE THE DISCONNECT BUTTON IN THE APP TO CLEAR YOUR TOKENS AND CACHED
              ACTIVITIES FROM YOUR BROWSER. YOU CAN ALSO REVOKE ACCESS ANY TIME AT{' '}
              <a
                href="https://www.strava.com/settings/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FC4C02] hover:underline"
              >
                STRAVA.COM/SETTINGS/APPS
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              WHAT HAPPENS TO MY DATA?
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              YOUR DATA IS STREAMED FROM STRAVA TO YOUR DEVICE AND RENDERED LOCALLY. WE
              DON&apos;T STORE IT ON A SERVER. FULL DETAILS ARE ON THE{' '}
              <Link href="/privacy" className="text-[#FC4C02] hover:underline">
                PRIVACY POLICY
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              MY ACTIVITIES AREN&apos;T SHOWING / ARE OUT OF DATE
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              THE APP CACHES ACTIVITIES IN YOUR BROWSER FOR SPEED. USE THE REFRESH
              OPTION TO PULL THE LATEST FROM STRAVA. IF SOMETHING STILL LOOKS WRONG,
              DISCONNECT AND RECONNECT, OR EMAIL ME WITH DETAILS.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-[#FC4C02]">
              REPORTING A BUG
            </h2>
            <p className="text-sm leading-relaxed uppercase tracking-wider text-[#666]">
              EMAIL{' '}
              <a href="mailto:pete@ngenart.com" className="text-[#FC4C02] hover:underline">
                PETE@NGENART.COM
              </a>
              {' '}WITH WHAT YOU EXPECTED, WHAT HAPPENED, AND YOUR DEVICE/BROWSER. A
              SCREENSHOT HELPS A LOT.
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
