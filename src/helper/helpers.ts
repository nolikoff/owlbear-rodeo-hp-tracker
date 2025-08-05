import OBR, { Image, Item, Metadata } from "@owlbear-rodeo/sdk";
import { infoMetadataKey, itemMetadataKey, metadataKey } from "./variables.ts";
import {
    AttachmentMetadata,
    GMGMetadata,
    Limit,
    RoomMetadata,
    SceneMetadata,
} from "./types.ts";
import { isEqual, isObject, isUndefined } from "lodash";
import { IRoll, IRoomParticipant } from "dddice-js";
import { RollLogEntryType } from "../context/RollLogContext.tsx";
import { TTRPG_URL } from "../config.ts";
import axios from "axios";
import axiosRetry from "axios-retry";
import { chunk } from "lodash";
import { deleteItems, updateItems } from "./obrHelper.ts";
import { UserSettings } from "../api/tabletop-almanac/useUser.ts";

export const getYOffset = async (height: number) => {
    const metadata = (await OBR.room.getMetadata()) as Metadata;
    const roomMetadata = metadata[metadataKey] as RoomMetadata;
    let offset = roomMetadata ? (roomMetadata.hpBarOffset ?? 0) : 0;
    const offsetFactor = height / 150;
    offset *= offsetFactor;
    return offset;
};

export const getACOffset = async (height: number, width: number) => {
    const metadata = (await OBR.room.getMetadata()) as Metadata;
    const roomMetadata = metadata[metadataKey] as RoomMetadata;
    let offset = roomMetadata ? (roomMetadata.acOffset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
    offset.x = offset.x * (width / 150);
    offset.y = offset.y * (height / 150);
    return offset;
};

export const getAttachedItems = async (id: string, itemTypes: Array<string>) => {
    const items = await OBR.scene.items.getItemAttachments([id]);
    // why am I not using .filter()? because if I do there is a bug and I can't find it
    const attachments: Item[] = [];
    items.forEach((item) => {
        if (infoMetadataKey in item.metadata && itemTypes.indexOf(item.type) >= 0 && item.attachedTo === id) {
            attachments.push(item);
        }
    });

    return attachments;
};

export const calculatePercentage = async (data: GMGMetadata) => {
    const metadata = (await OBR.room.getMetadata()) as Metadata;
    const roomMetadata = metadata[metadataKey] as RoomMetadata;
    const segments = roomMetadata ? (roomMetadata.hpBarSegments ?? 0) : 0;

    const tempHp = data.stats.tempHp ?? 0;

    const percentage = data.maxHp === 0 || data.hp === 0 || data.hp < 0 ? 0 : (data.hp - tempHp) / data.maxHp;
    const tempPercentage = data.maxHp === 0 || tempHp === 0 ? 0 : tempHp / data.maxHp;

    if (segments === 0) {
        return { hpPercentage: percentage, tempHpPercentage: tempPercentage };
    } else {
        const minStep = 100 / segments;
        const numStepsHp = Math.ceil((percentage * 100) / minStep);
        const numStepsTempHp = Math.ceil((tempPercentage * 100) / minStep);
        return { hpPercentage: (numStepsHp * minStep) / 100, tempHpPercentage: (numStepsTempHp * minStep) / 100 };
    }
};

export const getImageBounds = async (item: Image) => {
    const dpi = await OBR.scene.grid.getDpi();
    const dpiScale = dpi / item.grid.dpi;
    const width = item.image.width * dpiScale * item.scale.x;
    const height = item.image.height * dpiScale * item.scale.y;
    const offsetX = (item.grid.offset.x / item.image.width) * width;
    const offsetY = (item.grid.offset.y / item.image.height) * height;

    return {
        position: {
            x: item.position.x - offsetX,
            y: item.position.y - offsetY,
        },
        width: width,
        height: height,
    };
};

export const deleteAttachments = async (attachments: Item[]) => {
    if (attachments.length > 0) {
        await deleteItems(attachments.map((attachment) => attachment.id));
    }
};

export const evalString = (s: string) => {
    const tokens = s.replace(/\s/g, "").match(/[+\-]?([0-9]+)/g) || [];

    // @ts-ignore this works but ts doesn't like it
    return tokens.reduce((sum: string, value: string) => parseFloat(sum) + parseFloat(value));
};

export const sortItems = (a: Item, b: Item) => {
    const aData = a.metadata[itemMetadataKey] as GMGMetadata;
    const bData = b.metadata[itemMetadataKey] as GMGMetadata;
    if (aData && bData && aData.index !== undefined && bData.index !== undefined) {
        if (aData.index < bData.index) {
            return -1;
        } else if (aData.index > bData.index) {
            return 1;
        } else {
            return 0;
        }
    }
    return 0;
};

/**
 * This function is used to determine the order of Items in the player view and in the Battle Tracker
 * It compares the index of the tokens to match the current order in the GM View.
 *
 * This function must not be used to order the Tokens in the GM view because in case Initiative order is reversed the index compare will always trigger a reorder
 * @param a
 * @param b
 */
export const sortItemsInitiative = (a: Item, b: Item) => {
    const aData = a.metadata[itemMetadataKey] as GMGMetadata;
    const bData = b.metadata[itemMetadataKey] as GMGMetadata;
    if (
        bData.initiative === aData.initiative &&
        !isUndefined(bData.stats.initiativeBonus) &&
        !isUndefined(aData.stats.initiativeBonus)
    ) {
        if (
            bData.stats.initiativeBonus === aData.stats.initiativeBonus &&
            !isUndefined(bData.index) &&
            !isUndefined(aData.index)
        ) {
            return aData.index - bData.index;
        }
        return bData.stats.initiativeBonus - aData.stats.initiativeBonus;
    }
    return bData.initiative - aData.initiative;
};

/**
 * This function is used to determine the order of Items in the GM view it compares initiative and initiative bonus but doesn't look at the index because in case to items have the same value the index in the GM view does not matter.
 *
 * This function must not be used to order the Tokens in the player view or the battle tracker because it might lead to a reverse order of tokens based on index
 * @param a
 * @param b
 * @param reverse
 */
export const sortByInitiative = (a: Item, b: Item, reverse: boolean) => {
    const aData = a.metadata[itemMetadataKey] as GMGMetadata;
    const bData = b.metadata[itemMetadataKey] as GMGMetadata;
    if (
        bData.initiative === aData.initiative &&
        !isUndefined(bData.stats.initiativeBonus) &&
        !isUndefined(aData.stats.initiativeBonus)
    ) {
        if (reverse) {
            return aData.stats.initiativeBonus - bData.stats.initiativeBonus;
        } else {
            return bData.stats.initiativeBonus - aData.stats.initiativeBonus;
        }
    }
    if (reverse) {
        return aData.initiative - bData.initiative;
    } else {
        return bData.initiative - aData.initiative;
    }
};

export const generateSlug = (string: string) => {
    let str = string.replace(/^\s+|\s+$/g, "");
    str = str.toLowerCase();
    str = str
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    return str;
};

export const getDamage = (text: string) => {
    const regex = /\d+d\d+/gi;
    const dice = regex.exec(text);

    return dice && dice.length > 0 ? dice[0] : null;
};

export const attachmentFilter = (attachment: Item, attachmentType: "BAR" | "HP" | "AC") => {
    if (infoMetadataKey in attachment.metadata) {
        const metadata = attachment.metadata[infoMetadataKey] as AttachmentMetadata;
        return metadata.isHpText && metadata.attachmentType === attachmentType;
    }
    return false;
};

export const getBgColor = (
    data: GMGMetadata,
    opacity: string = "0.2",
    disable: boolean = false,
    color: string = "#1C1B22",
) => {
    if ((data.hp === 0 && data.maxHp === 0) || disable) {
        return color;
    }

    const percent = data.hp / (data.stats.tempHp ? data.stats.tempHp + data.maxHp : data.maxHp);

    const g = 255 * percent;
    const r = 255 - 255 * percent;
    return "rgb(" + r + "," + g + `,0,${opacity})`;
};

export const objectsEqual = (obj1: Object, obj2: Object) => {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    // a forEach loop is not disrupted by a return
    for (const key of keys1) {
        // @ts-ignore obj1 has key
        const val1 = obj1[key];
        // @ts-ignore obj1 has key
        const val2 = obj2[key];

        const areObjects = isObject(val1) && isObject(val2);
        if ((areObjects && !objectsEqual(val1, val2)) || (!areObjects && val1 !== val2)) {
            return false;
        }
    }

    return true;
};

export const updateSceneMetadata = async (scene: SceneMetadata | null, data: Partial<SceneMetadata>) => {
    const ownMetadata: Metadata = {};
    ownMetadata[metadataKey] = { ...scene, ...data };

    if (!scene || !objectsEqual({ ...scene, ...data }, scene)) {
        await OBR.scene.setMetadata({ ...ownMetadata });
    }
};

export const updateRoomMetadata = async (
    room: RoomMetadata | null,
    data: Partial<RoomMetadata>,
    additionalData?: Metadata,
    force: boolean = false,
) => {
    const ownMetadata: Metadata = additionalData ?? {};
    ownMetadata[metadataKey] = { ...room, ...data };

    if (!room || !objectsEqual({ ...room, ...data }, room) || force) {
        await OBR.room.setMetadata({ ...ownMetadata });
    }
};

export const dddiceRollToRollLog = async (
    roll: IRoll,
    options?: { participant?: IRoomParticipant; owlbear_user_id?: string },
): Promise<RollLogEntryType> => {
    let username = roll.external_id ?? roll.user.username;
    let participantName = "";
    if (options && options.participant && options.participant.username) {
        participantName = options.participant.username;
    } else {
        const particip = roll.room.participants.find((p) => p.user.uuid === roll.user.uuid);
        if (particip && particip.username) {
            participantName = particip.username;
        }
    }

    if ((roll.user.name === "Guest User" && !roll.external_id) || username.includes("dndb")) {
        username = participantName;
    }

    return {
        uuid: roll.uuid,
        created_at: roll.created_at,
        equation: roll.equation,
        label: roll.label,
        is_hidden: roll.values.some((v) => v.is_hidden),
        total_value: roll.total_value,
        username: username,
        values: roll.values.map((v) => {
            if (v.is_user_value) {
                return `+${String(v.value)}`;
            } else {
                return String(v.value);
            }
        }),
        owlbear_user_id: options?.owlbear_user_id,
        participantUsername: participantName,
    };
};

export const getRoomDiceUser = (room: RoomMetadata | null, id: string | null) => {
    return room?.diceUser?.find((user) => user.playerId === id);
};

export const resyncToken = async (characterId: string) => {
    const items = await OBR.scene.items.getItems([characterId]);
    items.forEach((item) => {
        const data = item.metadata[itemMetadataKey] as GMGMetadata;
        updateHp(item, data);
        updateAc(item, data);
    });
};

export const getSearchString = (name: string): string => {
    const nameParts = name.split(" ");
    const lastToken = nameParts[nameParts.length - 1];
    if (lastToken.length < 3 || /^\d+$/.test(lastToken) || /\d/.test(lastToken)) {
        return nameParts.slice(0, nameParts.length - 1).join(" ");
    }
    return name;
};

export const getTASettings = async (): Promise<UserSettings | null> => {
    const roomData = await OBR.room.getMetadata();
    let apiKey = undefined;
    if (metadataKey in roomData) {
        const room = roomData[metadataKey] as RoomMetadata;
        apiKey = room.tabletopAlmanacAPIKey;
        if (apiKey) {
            const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
            axiosRetry(axios, {
                retries: 2,
                retryDelay: (_) => 200,
                retryCondition: (error) => error.message === "Network Error",
            });

            try {
                const response = await axios.request({
                    url: `${TTRPG_URL}/users/me/settings`,
                    method: "GET",
                    headers: headers,
                });
                if (response.status === 200) {
                    return response.data;
                }
            } catch {
                return null;
            }
        }
    }
    return null;
};


export const updateLimit = async (itemId: string, limitValues: Limit, usage?: number) => {
    if (limitValues) {
        await updateItems([itemId], (items) => {
            items.forEach((item) => {
                if (item) {
                    const metadata = item.metadata[itemMetadataKey] as GMGMetadata;
                    if (metadata) {
                        const index = metadata.stats.limits?.findIndex((l) => {
                            return l.id === limitValues.id;
                        });
                        if (index !== undefined) {
                            // @ts-ignore
                            item.metadata[itemMetadataKey]["stats"]["limits"][index]["used"] = Math.min(
                                limitValues.used + (isUndefined(usage) ? 1 : usage),
                                limitValues.max,
                            );
                        }
                    }
                }
            });
        });
    }
};

export const getTokenName = (token: Image) => {
    try {
        if (token.text && token.text.plainText && token.text.plainText.replaceAll(" ", "").length > 0) {
            return token.text.plainText;
        } else {
            return token.name;
        }
    } catch {
        return "";
    }
};

export const prepareTokenForGrimoire = async (contextItems: Array<Image>) => {
    const tokenIds: Array<string> = [];
    const settings = await getTASettings();
    const itemStatblocks = await getInitialValues(contextItems as Array<Image>, settings?.assign_ss_darkvision);
    await updateItems(
        contextItems.map((i) => i.id),
        (items) => {
            items.forEach((item) => {
                tokenIds.push(item.id);
                if (itemMetadataKey in item.metadata) {
                    const metadata = item.metadata[itemMetadataKey] as GMGMetadata;
                    metadata.hpTrackerActive = true;
                    item.metadata[itemMetadataKey] = metadata;
                } else {
                    // variable allows us to be typesafe
                    const defaultMetadata: GMGMetadata = {
                        hp: 0,
                        maxHp: 0,
                        armorClass: 0,
                        hpTrackerActive: true,
                        hpOnMap: settings?.default_token_settings?.hpOnMap || false,
                        acOnMap: settings?.default_token_settings?.acOnMap || false,
                        hpBar: settings?.default_token_settings?.hpOnMap || false,
                        initiative: 0,
                        sheet: "",
                        stats: {
                            initiativeBonus: 0,
                            initial: true,
                        },
                        playerMap: {
                            hp: settings?.default_token_settings?.playerMap?.hp || false,
                            ac: settings?.default_token_settings?.playerMap?.ac || false,
                        },
                        playerList: settings?.default_token_settings?.playerList || false,
                    };
                    if (item.id in itemStatblocks) {
                        defaultMetadata.sheet = itemStatblocks[item.id].slug;
                        defaultMetadata.ruleset = itemStatblocks[item.id].ruleset;
                        defaultMetadata.maxHp = itemStatblocks[item.id].hp;
                        defaultMetadata.hp = itemStatblocks[item.id].hp;
                        defaultMetadata.armorClass = itemStatblocks[item.id].ac;
                        defaultMetadata.stats.initiativeBonus = itemStatblocks[item.id].bonus;
                        defaultMetadata.stats.initial = true;
                        defaultMetadata.stats.limits = itemStatblocks[item.id].limits;
                        defaultMetadata.equipment = itemStatblocks[item.id].equipment;
                    }
                    item.metadata[itemMetadataKey] = defaultMetadata;
                    if (settings?.assign_ss_darkvision && itemStatblocks[item.id]?.darkvision) {
                        item.metadata["com.battle-system.smoke/visionDark"] = String(
                            itemStatblocks[item.id].darkvision,
                        );
                        item.metadata["com.battle-system.smoke/visionRange"] = String(
                            itemStatblocks[item.id].darkvision,
                        );
                    }
                }
            });
        },
    );
    return tokenIds;
};

export const reorderMetadataIndex = async (list: Array<Image>, group?: string) => {
    const chunks = chunk(list, 12);
    let index = 0;
    for (const subList of chunks) {
        try {
            await updateItems(
                subList.map((i) => i.id),
                (items) => {
                    items.forEach((item) => {
                        const data = item.metadata[itemMetadataKey] as GMGMetadata;
                        data.index = index;
                        if (group) {
                            data.group = group;
                        }
                        index++;
                        item.metadata[itemMetadataKey] = { ...data };
                    });
                },
            );
        } catch (e) {
            const errorName =
                isObject(e) && "error" in e && isObject(e.error) && "name" in e.error
                    ? e.error.name
                    : "Undefined Error";
            console.warn(`GM's Grimoire: Error while updating reordering ${subList.length} tokens: ${errorName}`);
        }
    }
};

export const orderByInitiative = async (tokenMap: Map<string, Array<Image>>, reverse: boolean = false) => {
    const groups = tokenMap.values();

    for (const group of groups) {
        const reordered = Array.from(group);
        reordered.sort((a, b) => sortByInitiative(a, b, reverse));
        if (!isEqual(group, reordered)) {
            await reorderMetadataIndex(reordered);
        }
    }
};
export const modulo = (n: number, m: number) => {
    return ((n % m) + m) % m;
};

export const delay = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
