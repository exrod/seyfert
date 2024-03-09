import {
	FormattingPatterns,
	type APIGuildMember,
	type GuildMemberResolvable,
	type RESTGetAPIGuildMembersQuery,
	type RESTGetAPIGuildMembersSearchQuery,
	type RESTPatchAPIGuildMemberJSONBody,
	type RESTPutAPIGuildBanJSONBody,
	type RESTPutAPIGuildMemberJSONBody,
} from '..';
import { GuildMember } from '../../structures';
import { BaseShorter } from './base';

export class MemberShorter extends BaseShorter {
	/**
	 * Provides access to member-related functionality in a guild.
	 */
	get members() {
		return {
			/**
			 * Resolves a member in the guild based on the provided GuildMemberResolvable.
			 * @param guildId The ID of the guild.
			 * @param resolve The GuildMemberResolvable to resolve.
			 * @returns A Promise that resolves to the resolved member.
			 */
			resolve: async (guildId: string, resolve: GuildMemberResolvable) => {
				if (typeof resolve === 'string') {
					const match: { id?: string } | undefined = resolve.match(FormattingPatterns.User)?.groups;
					if (match?.id) {
						return this.members.fetch(guildId, match.id);
					}
					if (resolve.match(/\d{17,20}/)) {
						return this.members.fetch(guildId, resolve);
					}
					return this.members.search(guildId, { query: resolve, limit: 1 }).then(x => x[0]);
				}
				if (resolve.id) {
					return this.client.members.fetch(guildId, resolve.id);
				}
				return resolve.displayName
					? this.members.search(guildId, { query: resolve.displayName, limit: 1 }).then(x => x[0])
					: undefined;
			},

			/**
			 * Searches for members in the guild based on the provided query.
			 * @param guildId The ID of the guild.
			 * @param query The query parameters for searching members.
			 * @returns A Promise that resolves to an array of matched members.
			 */
			search: async (guildId: string, query?: RESTGetAPIGuildMembersSearchQuery) => {
				const members = await this.client.proxy.guilds(guildId).members.search.get({
					query,
				});
				await this.client.cache.members?.set(
					members.map(x => [x.user!.id, x]),
					guildId,
				);
				return members.map(m => new GuildMember(this.client, m, m.user!, guildId));
			},

			/**
			 * Unbans a member from the guild.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to unban.
			 * @param body The request body for unbanning the member.
			 * @param reason The reason for unbanning the member.
			 */
			unban: async (guildId: string, memberId: string, body?: RESTPutAPIGuildBanJSONBody, reason?: string) => {
				await this.client.proxy.guilds(guildId).bans(memberId).delete({ reason, body });
			},

			/**
			 * Bans a member from the guild.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to ban.
			 * @param body The request body for banning the member.
			 * @param reason The reason for banning the member.
			 */
			ban: async (guildId: string, memberId: string, body?: RESTPutAPIGuildBanJSONBody, reason?: string) => {
				await this.client.proxy.guilds(guildId).bans(memberId).put({ reason, body });
				await this.client.cache.members?.removeIfNI('GuildBans', memberId, guildId);
			},

			/**
			 * Kicks a member from the guild.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to kick.
			 * @param reason The reason for kicking the member.
			 */
			kick: async (guildId: string, memberId: string, reason?: string) => {
				await this.client.proxy.guilds(guildId).members(memberId).delete({ reason });
				await this.client.cache.members?.removeIfNI('GuildMembers', memberId, guildId);
			},

			/**
			 * Edits a member in the guild.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to edit.
			 * @param body The data to update the member with.
			 * @param reason The reason for editing the member.
			 * @returns A Promise that resolves to the edited member.
			 */
			edit: async (guildId: string, memberId: string, body: RESTPatchAPIGuildMemberJSONBody, reason?: string) => {
				const member = await this.client.proxy.guilds(guildId).members(memberId).patch({ body, reason });
				await this.client.cache.members?.setIfNI('GuildMembers', memberId, guildId, member);
				return new GuildMember(this.client, member, member.user!, guildId);
			},

			/**
			 * Adds a member to the guild.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to add.
			 * @param body The request body for adding the member.
			 * @returns A Promise that resolves to the added member.
			 */
			add: async (guildId: string, memberId: string, body: RESTPutAPIGuildMemberJSONBody) => {
				const member = await this.client.proxy.guilds(guildId).members(memberId).put({
					body,
				});

				// Thanks dapi-types, fixed
				if (!member) {
					return;
				}

				await this.client.cache.members?.setIfNI('GuildMembers', member.user!.id, guildId, member);

				return new GuildMember(this.client, member, member.user!, guildId);
			},

			/**
			 * Fetches a member from the guild.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to fetch.
			 * @param force Whether to force fetching the member from the API even if it exists in the cache.
			 * @returns A Promise that resolves to the fetched member.
			 */
			fetch: async (guildId: string, memberId: string, force = false) => {
				let member;
				if (!force) {
					member = await this.client.cache.members?.get(memberId, guildId);
					if (member) return member;
				}

				member = await this.client.proxy.guilds(guildId).members(memberId).get();
				await this.client.cache.members?.set(member.user!.id, guildId, member);
				return new GuildMember(this.client, member, member.user!, guildId);
			},

			/**
			 * Lists members in the guild based on the provided query.
			 * @param guildId The ID of the guild.
			 * @param query The query parameters for listing members.
			 * @param force Whether to force listing members from the API even if they exist in the cache.
			 * @returns A Promise that resolves to an array of listed members.
			 */
			list: async (guildId: string, query?: RESTGetAPIGuildMembersQuery, force = false) => {
				let members;
				if (!force) {
					members = (await this.client.cache.members?.values(guildId)) ?? [];
					if (members.length) return members;
				}
				members = await this.client.proxy.guilds(guildId).members.get({
					query,
				});
				await this.client.cache.members?.set(members.map(x => [x.user!.id, x]) as [string, APIGuildMember][], guildId);
				return members.map(m => new GuildMember(this.client, m, m.user!, guildId));
			},
			/**
			 * Provides methods to add and remove roles from a guild member.
			 */
			roles: this.roles,
		};
	}

	get roles() {
		return {
			/**
			 * Adds a role to a guild member.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to add the role to.
			 * @param id The ID of the role to add.
			 */
			add: async (guildId: string, memberId: string, id: string) => {
				await this.client.proxy.guilds(guildId).members(memberId).roles(id).put({});
			},

			/**
			 * Removes a role from a guild member.
			 * @param guildId The ID of the guild.
			 * @param memberId The ID of the member to remove the role from.
			 * @param id The ID of the role to remove.
			 */
			remove: async (guildId: string, memberId: string, id: string) => {
				await this.client.proxy.guilds(guildId).members(memberId).roles(id).delete();
			},
		};
	}
}
