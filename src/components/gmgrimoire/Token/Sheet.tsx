import { useTokenListContext } from "../../../context/TokenContext.tsx";
import "./sheet.scss";
import { useEffect, useState } from "react";
import OBR, { Image, Player } from "@owlbear-rodeo/sdk";
import { usePlayerContext } from "../../../context/PlayerContext.ts";
import Tippy from "@tippyjs/react";
import { useShallow } from "zustand/react/shallow";

export const Sheet = ({ id }: { id: string }) => {
    const playerContext = usePlayerContext();
    const token = useTokenListContext(useShallow((state) => state.tokens?.get(id)));
    const item = token?.item as Image;
    const [players, setPlayers] = useState<Array<Player>>([]);
    const owner = players.find((p) => p.id === item.createdUserId)?.id ?? playerContext.id ?? "";

    useEffect(() => {
        const initPlayerList = async () => {
            setPlayers(await OBR.party.getPlayers());
        };

        initPlayerList();
        return OBR.party.onChange((players) => {
            setPlayers(players);
        });
    }, []);

    return (
        <div className={"sheet"}>
             {playerContext.role === "GM" ? (
                 <>
                     {item.createdUserId !== playerContext.id ? (
                         <div
                             className={"owner-color"}
                             style={{
                                 backgroundColor:
                                     players.find((p) => p.id === item.createdUserId)?.color ?? "transparent",
                             }}
                         ></div>
                     ) : null}
                     <Tippy content={"Assign token owner"}>
                         <select
                             value={owner}
                             onChange={async (e) => {
                                 // this doesn't work with the abstraction layer
                                 await OBR.scene.items.updateItems([item], (items) => {
                                     items.forEach((item) => {
                                         item.createdUserId = e.target.value;
                                     });
                                 });
                             }}
                             className={"select-owner"}
                         >
                             <option value={OBR.player.id}>GM</option>
                             {players.map((player) => {
                                 return (
                                     <option key={player.id} value={player.id}>
                                         {player.name}
                                     </option>
                                 );
                             })}
                         </select>
                     </Tippy>
                 </>
             ) : null}
        </div>
    );
};
