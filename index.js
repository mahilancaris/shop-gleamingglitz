/**
 * AETHER VAULT - FULL INTERACTIVE DISCORD BOT
 * Two-way control with Slash Commands (/backup, /status, /servers, /history, /ping)
 */

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.resolve(__dirname, '../storage/settings.json');

/**
 * Load System Settings
 */
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error('[Config] Failed to load settings.json:', err.message);
    }
    return {};
}

const settings = loadSettings();
const discordConfig = settings.discord || {};

const BOT_TOKEN = discordConfig.bot_token || process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = discordConfig.client_id || process.env.DISCORD_CLIENT_ID;
const GUILD_ID = discordConfig.guild_id || process.env.DISCORD_GUILD_ID;
const API_SECRET = discordConfig.api_secret || '';
const API_URL = discordConfig.internal_api_url || 'http://127.0.0.1/xxx/api/bot_api.php';

console.log('='.repeat(60));
console.log('⚡ AETHER VAULT INTERACTIVE DISCORD BOT');
console.log('='.repeat(60));

if (!BOT_TOKEN) {
    console.log('\n' + '='.repeat(64));
    console.log('❌ DISCORD BOT TOKEN NOT CONFIGURED YET');
    console.log('='.repeat(64));
    console.log('👉 Please add your Discord Bot Token in the Aether Vault Dashboard:');
    console.log('   1. Open: http://localhost/xxx/');
    console.log('   2. Go to: Settings ➔ Discord Integration & Interactive Bot');
    console.log('   3. Paste your Bot Token and click "Save All Settings"');
    console.log('   4. Then restart this bot window.');
    console.log('='.repeat(64) + '\n');
    process.exit(1);
}

/**
 * Helper to call Aether Vault Bot API
 */
async function callVaultApi(action, params = {}, method = 'GET') {
    let url = `${API_URL}?action=${encodeURIComponent(action)}`;
    const headers = {
        'X-Bot-Secret': API_SECRET,
        'Accept': 'application/json'
    };

    let fetchOptions = { method, headers };

    if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify({ action, ...params });
    } else {
        const q = new URLSearchParams(params);
        if (q.toString()) {
            url += '&' + q.toString();
        }
    }

    try {
        const res = await fetch(url, fetchOptions);
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('[API Parse Error] Response from', url, ':\n', text.substring(0, 300));
            return { success: false, error: `Invalid server response (${res.status})` };
        }
    } catch (err) {
        console.error('[API Fetch Error]', err.message);
        return { success: false, error: `Connection to Aether Vault API failed: ${err.message}` };
    }
}

/**
 * Slash Commands Definition
 */
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Test latency and check Aether Vault connectivity & system info'),

    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Real-time health status of database servers, pulse & storage'),

    new SlashCommandBuilder()
        .setName('servers')
        .setDescription('List all connected MySQL server nodes and available databases'),

    new SlashCommandBuilder()
        .setName('history')
        .setDescription('View recent database backup archives, file sizes, and timestamps')
        .addIntegerOption(opt =>
            opt.setName('limit')
                .setDescription('Number of recent records to display (1 to 10)')
                .setMinValue(1)
                .setMaxValue(10)
        ),

    new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Execute an immediate on-demand database backup')
        .addStringOption(opt =>
            opt.setName('database')
                .setDescription('Specific database name to backup (leave blank for all)')
        )
        .addStringOption(opt =>
            opt.setName('server_id')
                .setDescription('Server node ID (e.g., srv_local, or leave blank for all active servers)')
        ),

    new SlashCommandBuilder()
        .setName('backupall')
        .setDescription('⚡ Execute instant simultaneous backup of ALL databases across ALL VPS and server nodes'),

    new SlashCommandBuilder()
        .setName('vps')
        .setDescription('🖥️ Display all connected VPS hosting nodes, specifications, IP addresses, and live health')
];

/**
 * Register Slash Commands with Discord REST API
 */
async function registerCommands(clientId, token, guildId) {
    if (!clientId) {
        console.warn('⚠️ Client ID (Application ID) not specified. Trying to infer from token...');
    }

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('🔄 Registering Discord Slash Commands...');
        const body = commands.map(cmd => cmd.toJSON());

        if (guildId) {
            // Guild-specific registration is instant
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body }
            );
            console.log(`✅ Successfully registered ${commands.length} slash commands to Guild (${guildId})!`);
        } else if (clientId) {
            // Global registration
            await rest.put(
                Routes.applicationCommands(clientId),
                { body }
            );
            console.log(`✅ Successfully registered ${commands.length} global slash commands!`);
        }
    } catch (err) {
        console.error('❌ Failed to register slash commands:', err.message);
    }
}

// Initialize Client (GatewayIntentBits.Guilds is sufficient for Slash Commands!)
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag} (ID: ${client.user.id})`);
    console.log(`🌐 Serving in ${client.guilds.cache.size} server(s)`);

    // Auto-register commands if CLIENT_ID was not configured
    const effectiveClientId = CLIENT_ID || client.user.id;
    await registerCommands(effectiveClientId, BOT_TOKEN, GUILD_ID);

    console.log('🚀 Aether Vault Discord Bot is LIVE and ready for slash commands!');
    console.log('Try typing /status or /backup in your Discord server.');
    console.log('='.repeat(60));
});

/**
 * Handle Slash Command Interactions
 */
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // -------------------------------------------------------------------------
    // Command: /ping
    // -------------------------------------------------------------------------
    if (commandName === 'ping') {
        const start = Date.now();
        await interaction.deferReply();
        const apiRes = await callVaultApi('ping');
        const botLatency = Date.now() - start;
        const apiLatency = client.ws.ping;

        const isSuccess = apiRes.success !== false;
        const sys = apiRes.system || {};

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong! Aether Vault Diagnostics')
            .setColor(isSuccess ? 0x10B981 : 0xF43F5E)
            .addFields(
                { name: 'Gateway Latency', value: `\`${apiLatency} ms\``, inline: true },
                { name: 'Bot Roundtrip', value: `\`${botLatency} ms\``, inline: true },
                { name: 'API Status', value: isSuccess ? '🟢 Online' : '🔴 Unreachable', inline: true },
                { name: 'Host System', value: sys.hostname || 'Localhost', inline: true },
                { name: 'OS / PHP', value: `${sys.os || 'Windows'} • PHP ${sys.php_version || '8.x'}`, inline: true },
                { name: 'Disk Free Space', value: `${sys.disk_free || 'N/A'} (${sys.disk_percent_free || 0}% free)`, inline: true }
            )
            .setFooter({ text: 'Aether Vault DB Engine • v2.5.0', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------------------
    // Command: /status
    // -------------------------------------------------------------------------
    if (commandName === 'status') {
        await interaction.deferReply();
        const res = await callVaultApi('status');

        if (!res.success) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Status Check Failed')
                        .setDescription(`Could not reach Aether Vault backend:\n\`${res.error || 'Unknown error'}\``)
                        .setColor(0xF43F5E)
                        .setTimestamp()
                ]
            });
        }

        const isHealthy = res.overall_status === 'healthy';
        const servers = res.servers || [];
        const storage = res.storage || {};

        const embed = new EmbedBuilder()
            .setTitle(isHealthy ? '🟢 All Database Systems Operational' : '⚠️ Database Infrastructure Alert')
            .setDescription(`Real-time telemetry from **${servers.length}** configured server node(s).`)
            .setColor(isHealthy ? 0x10B981 : 0xF59E0B)
            .setTimestamp();

        // Server node fields
        servers.forEach(srv => {
            const badge = srv.status === 'online' ? '🟢 Online' : '🔴 Offline';
            const value = srv.status === 'online'
                ? `**Host:** \`${srv.host}:${srv.port}\`\n**Latency:** \`${srv.latency_ms} ms\`\n**Active DBs:** \`${srv.databases_count}\``
                : `**Host:** \`${srv.host}:${srv.port}\`\n**Error:** ${srv.error || 'Unreachable'}`;

            embed.addFields({
                name: `${badge} • ${srv.name}`,
                value: value,
                inline: true
            });
        });

        // Storage & backups overview
        embed.addFields(
            {
                name: '💾 Storage & Archives',
                value: `**Total Backups:** \`${storage.backup_count || 0}\` archives (${storage.total_size || '0 B'})\n**Storage Free:** \`${storage.disk_free || 'N/A'}\` (${storage.disk_percent_free || 0}% available)`,
                inline: false
            }
        );

        embed.setFooter({ text: 'Aether Vault Live Health Pulse', iconURL: client.user.displayAvatarURL() });
        return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------------------
    // Command: /servers
    // -------------------------------------------------------------------------
    if (commandName === 'servers') {
        await interaction.deferReply();
        const res = await callVaultApi('servers');

        if (!res.success) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Server Query Failed')
                        .setDescription(res.error || 'Failed to fetch server nodes.')
                        .setColor(0xF43F5E)
                ]
            });
        }

        const servers = res.servers || [];
        const embed = new EmbedBuilder()
            .setTitle(`🗄️ Database Server Nodes (${servers.length})`)
            .setColor(0x38BDF8)
            .setDescription('Registered database sources ready for automated & manual backups.')
            .setTimestamp();

        servers.forEach(s => {
            const dbList = (s.databases && s.databases.length > 0)
                ? s.databases.map(d => `\`${d}\``).join(', ')
                : '_No accessible user databases_';

            embed.addFields({
                name: `${s.online ? '🟢' : '🔴'} ${s.name} (${s.id})`,
                value: `**Address:** \`${s.user}@${s.host}:${s.port}\`\n**Databases (${s.databases ? s.databases.length : 0}):**\n${dbList}`,
                inline: false
            });
        });

        embed.setFooter({ text: 'Aether Vault Cluster Configuration', iconURL: client.user.displayAvatarURL() });
        return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------------------
    // Command: /history
    // -------------------------------------------------------------------------
    if (commandName === 'history') {
        const limit = interaction.options.getInteger('limit') || 5;
        await interaction.deferReply();
        const res = await callVaultApi('history', { limit });

        if (!res.success) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ History Query Failed')
                        .setDescription(res.error || 'Failed to fetch backup history.')
                        .setColor(0xF43F5E)
                ]
            });
        }

        const backups = res.backups || [];
        const embed = new EmbedBuilder()
            .setTitle(`📦 Recent Backup Archives (${backups.length} of ${res.total_backups || 0})`)
            .setColor(0x8B5CF6)
            .setDescription(`Showing the latest **${backups.length}** compressed snapshots.`)
            .setTimestamp();

        if (backups.length === 0) {
            embed.setDescription('No backup archives found in local storage yet. Use `/backup` to create one!');
        } else {
            backups.forEach((b, idx) => {
                embed.addFields({
                    name: `${idx + 1}. \`${b.file_name}\``,
                    value: `**Database:** \`${b.database_hint}\` • **Server:** \`${b.server_hint}\`\n**Size:** \`${b.size_formatted}\` • **Created:** \`${b.created_at}\``,
                    inline: false
                });
            });
        }

        embed.setFooter({ text: 'Aether Vault Archive Vault', iconURL: client.user.displayAvatarURL() });
        return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------------------
    // Command: /backup
    // -------------------------------------------------------------------------
    if (commandName === 'backup') {
        const targetDb = interaction.options.getString('database');
        const targetServerId = interaction.options.getString('server_id');

        await interaction.deferReply();

        // Initial progress indicator
        const targetDesc = targetDb ? `database **\`${targetDb}\`**` : 'all active databases';
        const serverDesc = targetServerId ? `on server **\`${targetServerId}\`**` : 'across all active servers';

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('⏳ Executing On-Demand Backup...')
                    .setDescription(`Archiving ${targetDesc} ${serverDesc}.\nPlease hold on while mysqldump & gzip compression execute.`)
                    .setColor(0xF59E0B)
                    .setTimestamp()
            ]
        });

        const res = await callVaultApi('backup', {
            database: targetDb,
            server_id: targetServerId
        }, 'POST');

        if (!res.success) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Database Backup Failed')
                        .setDescription(`Aether Vault encountered an error:\n\`${res.error || 'Unknown error'}\``)
                        .setColor(0xF43F5E)
                        .addFields(
                            { name: 'Details', value: (res.details && res.details.length) ? res.details.join('\n') : 'Check server logs.' }
                        )
                        .setTimestamp()
                ]
            });
        }

        const files = res.files || [];
        const embed = new EmbedBuilder()
            .setTitle('✅ Database Backup Completed Successfully!')
            .setDescription(`Successfully created **${files.length}** compressed database archive(s) in **${res.duration}s**.`)
            .setColor(0x10B981)
            .setTimestamp();

        const attachments = [];

        files.forEach((f, idx) => {
            embed.addFields({
                name: `📁 ${f.database} (${f.server})`,
                value: `**File:** \`${f.file_name}\`\n**Size:** \`${f.size_formatted}\``,
                inline: true
            });

            // If file is under 24MB Discord attachment limit and exists locally, attach it!
            if (f.file_path && fs.existsSync(f.file_path)) {
                const stat = fs.statSync(f.file_path);
                if (stat.size <= 24 * 1024 * 1024 && attachments.length < 5) {
                    attachments.push(new AttachmentBuilder(f.file_path, { name: f.file_name }));
                }
            }
        });

        if (attachments.length > 0) {
            embed.addFields({
                name: '☁️ Discord Cloud Drive',
                value: `Attached **${attachments.length}** \`.sql.gz\` file(s) directly to this message for instant download.`,
                inline: false
            });
        }

        embed.setFooter({
            text: `Triggered by @${interaction.user.username} via Aether Vault Bot`,
            iconURL: interaction.user.displayAvatarURL()
        });

        return interaction.editReply({
            embeds: [embed],
            files: attachments
        });
    }

    // -------------------------------------------------------------------------
    // Command: /backupall (Full Simultaneous Cluster Backup)
    // -------------------------------------------------------------------------
    if (commandName === 'backupall') {
        await interaction.deferReply();

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('⚡ Executing Full Cluster Backup (/backupall)...')
                    .setDescription('Initiating simultaneous database dump and compression across **ALL registered VPS and Database Server Nodes**.\nPlease wait...')
                    .setColor(0xF59E0B)
                    .setTimestamp()
            ]
        });

        // Call API without parameters = all active servers & all non-system databases!
        const res = await callVaultApi('backup', {}, 'POST');

        if (!res.success) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Cluster Backup Failed')
                        .setDescription(`Aether Vault encountered an issue during full cluster backup:\n\`${res.error || 'Unknown error'}\``)
                        .setColor(0xF43F5E)
                        .addFields(
                            { name: 'Errors / Details', value: (res.details && res.details.length) ? res.details.slice(0, 5).join('\n') : 'Check server logs.' }
                        )
                        .setTimestamp()
                ]
            });
        }

        const files = res.files || [];
        const totalSize = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
        const formatMb = (totalSize / (1024 * 1024)).toFixed(2) + ' MB';

        const embed = new EmbedBuilder()
            .setTitle('🌟 Full Cluster Backup Completed Successfully!')
            .setDescription(`Successfully backed up **${files.length}** databases across all active servers in **${res.duration}s**.\n**Total Data Size:** \`${formatMb}\``)
            .setColor(0x10B981)
            .setTimestamp();

        const attachments = [];
        files.forEach((f, idx) => {
            if (idx < 10) { // Keep embed tidy
                embed.addFields({
                    name: `📁 ${f.database} • ${f.server}`,
                    value: `\`${f.file_name}\` (${f.size_formatted})`,
                    inline: true
                });
            }

            // Attach files under 24MB Discord limit
            if (f.file_path && fs.existsSync(f.file_path)) {
                const stat = fs.statSync(f.file_path);
                if (stat.size <= 24 * 1024 * 1024 && attachments.length < 5) {
                    attachments.push(new AttachmentBuilder(f.file_path, { name: f.file_name }));
                }
            }
        });

        if (files.length > 10) {
            embed.addFields({
                name: '... and more',
                value: `+ ${files.length - 10} additional databases archived in vault storage.`,
                inline: false
            });
        }

        if (attachments.length > 0) {
            embed.addFields({
                name: '☁️ Discord Cloud Attachments',
                value: `Uploaded **${attachments.length}** compressed \`.sql.gz\` file(s) directly to this channel.`,
                inline: false
            });
        }

        embed.setFooter({
            text: `Cluster backup executed by @${interaction.user.username} via Aether Vault Bot`,
            iconURL: interaction.user.displayAvatarURL()
        });

        return interaction.editReply({
            embeds: [embed],
            files: attachments
        });
    }

    // -------------------------------------------------------------------------
    // Command: /vps (VPS Hosting & Server Nodes Details)
    // -------------------------------------------------------------------------
    if (commandName === 'vps') {
        await interaction.deferReply();
        const res = await callVaultApi('vps');

        if (!res.success) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Failed to Fetch VPS Details')
                        .setDescription(res.error || 'Could not retrieve VPS list from Aether Vault.')
                        .setColor(0xF43F5E)
                ]
            });
        }

        const vpsList = res.vps_nodes || [];
        const embed = new EmbedBuilder()
            .setTitle(`🖥️ Connected VPS & Server Hosting Nodes (${vpsList.length})`)
            .setDescription('Overview of all registered VPS hosting environments, specs, and status.')
            .setColor(0x38BDF8)
            .setTimestamp();

        if (vpsList.length === 0) {
            embed.setDescription('No VPS server nodes registered yet. Add them in the Aether Vault Dashboard under Database Servers!');
        } else {
            vpsList.forEach(vps => {
                const statusBadge = vps.online ? '🟢 Online' : '🔴 Offline';
                const latency = vps.online ? `\`${vps.latency_ms} ms\`` : '_Unreachable_';
                const provider = vps.provider || 'Custom VPS';
                const specs = vps.specs ? ` • ${vps.specs}` : '';
                const location = vps.location ? ` • ${vps.location}` : '';
                const os = vps.os ? ` • ${vps.os}` : '';

                const dbList = (vps.databases && vps.databases.length > 0)
                    ? vps.databases.slice(0, 8).map(d => `\`${d}\``).join(', ') + (vps.databases.length > 8 ? ` +${vps.databases.length - 8} more` : '')
                    : '_No active databases_';

                embed.addFields({
                    name: `${statusBadge} • ${vps.name} [${provider}]`,
                    value: `**IP / Host:** \`${vps.host}:${vps.port}\`\n**Specs:** \`${provider}${specs}${os}${location}\`\n**Ping Latency:** ${latency}\n**Databases (${vps.databases ? vps.databases.length : 0}):**\n${dbList}`,
                    inline: false
                });
            });
        }

        embed.setFooter({
            text: 'Aether Vault Multi-VPS Cluster Controller',
            iconURL: client.user.displayAvatarURL()
        });

        return interaction.editReply({ embeds: [embed] });
    }
});

// Connect to Discord Gateway
client.login(BOT_TOKEN).catch(err => {
    console.error('❌ Login Error:', err.message);
    if (err.message.includes('TOKEN_INVALID') || err.message.includes('An invalid token')) {
        console.error('👉 The Bot Token in storage/settings.json is invalid. Please generate a new Bot Token in the Discord Developer Portal.');
    }
});
