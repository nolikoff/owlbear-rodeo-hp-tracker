import { Droppable } from "@hello-pangea/dnd";
import { DraggableTokenList } from "./TokenList.tsx";
import OBR, { Image, Metadata } from "@owlbear-rodeo/sdk";
import { SceneMetadata } from "../../helper/types.ts";
import { metadataKey } from "../../helper/variables.ts";
import {
    getAcForPlayers,
    getAcOnMap,
    getHpForPlayers,
    getHpOnMap,
    toggleAcForPlayers,
    toggleAcOnMap,
    toggleHpForPlayers,
    toggleHpOnMap,
} from "../../helper/multiTokenHelper.ts";
import { useMetadataContext } from "../../context/MetadataContext.ts";
import { MapButton } from "./Token/MapButton.tsx";
import { HPSvg } from "../svgs/HPSvg.tsx";
import { ACSvg } from "../svgs/ACSvg.tsx";
import Tippy from "@tippyjs/react";
import "./drop-group.scss";
import { useShallow } from "zustand/react/shallow";

type DropGroupProps = {
    title: string;
    list: Array<Image>;
    selected: Array<string>;
    tokenLists: Map<string, Array<Image>>;
};

export const DropGroup = (props: DropGroupProps) => {
    const [room, scene] = useMetadataContext(
        useShallow((state) => [state.room, state.scene]),
    );

    const setOpenGroupSetting = async (name: string) => {
        const metadata: Metadata = await OBR.scene.getMetadata();
        const hpTrackerSceneMetadata = metadata[metadataKey] as SceneMetadata;
        if (hpTrackerSceneMetadata.openGroups && hpTrackerSceneMetadata.openGroups.indexOf(name) >= 0) {
            hpTrackerSceneMetadata.openGroups.splice(hpTrackerSceneMetadata.openGroups.indexOf(name), 1);
        } else {
            hpTrackerSceneMetadata.openGroups?.push(name);
        }
        const ownMetadata: Metadata = {};
        ownMetadata[metadataKey] = hpTrackerSceneMetadata;
        await OBR.scene.setMetadata(ownMetadata);
    };

    return (
        <div
            className={`group-wrapper ${
                scene?.openGroups && scene?.openGroups?.indexOf(props.title) >= 0 ? "" : "hidden"
            }`}
        >
            <div className={"group-title"}>
                <div className={"group-general"}>
                    <Tippy content={props.title}>
                        <div className={"group-name"}>
                            <span>{props.title}</span>
                        </div>
                    </Tippy>
                </div>
                <div className={"settings"}>
                    <div className={"setting"}>
                        <HPSvg percent={100} name={"hp"} color={"#888888"} />
                        <MapButton
                            onClick={async () => {
                                await toggleHpOnMap(props.list, room);
                            }}
                            onContextMenu={async () => {
                                await toggleHpForPlayers(props.list);
                            }}
                            active={getHpOnMap(props.list)}
                            players={getHpForPlayers(props.list)}
                            tooltip={"Show HP on map (right click for players)"}
                        />
                    </div>
                    <div className={"setting"}>
                        <ACSvg />
                        <MapButton
                            onClick={async () => {
                                await toggleAcOnMap(props.list);
                            }}
                            onContextMenu={async () => {
                                await toggleAcForPlayers(props.list);
                            }}
                            active={getAcOnMap(props.list)}
                            players={getAcForPlayers(props.list)}
                            tooltip={"Show AC on map (right click for players)"}
                        />
                    </div>
                </div>

                <button
                    className={"hide-group"}
                    onClick={async () => {
                        await setOpenGroupSetting(props.title);
                    }}
                ></button>
            </div>
            <Droppable droppableId={props.title}>
                {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        <DraggableTokenList
                            tokens={props.list}
                            selected={props.selected}
                            tokenLists={props.tokenLists}
                        />
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
};
