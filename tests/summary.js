// Prints the probe's report and exits non-zero if any check failed.
const {GLib} = imports.gi;

const [, bytes] = GLib.file_get_contents(ARGV[0]);
const report = JSON.parse(new TextDecoder().decode(bytes));
let failed = 0;
for (const check of report.checks) {
    if (!check.ok)
        failed++;
    print(`${check.ok ? 'ok   ' : 'FAIL '} ${check.name}${check.ok || !check.detail ? '' : `  (${check.detail})`}`);
}
const dressed = (report.notes.dressCalls ?? []).filter(call => call.dressed);
if (dressed.length > 0) {
    print('\nTime taken to dress the lock screen, in milliseconds:');
    for (const call of dressed)
        print(`  ${call.ms.toFixed(1).padStart(6)}   ${call.step}`);
}
print(`GNOME Shell ${report.shell} (session mode ${report.mode}): ${report.checks.length - failed} of ${report.checks.length} checks passed`);
if (failed > 0 || report.checks.length === 0)
    imports.system.exit(1);
