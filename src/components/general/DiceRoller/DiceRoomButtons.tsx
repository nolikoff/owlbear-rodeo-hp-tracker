type DiceRoomButtonsProps = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

export const DiceRoomButtons = (props: DiceRoomButtonsProps) => {
    props.setOpen(false);
        
    return (
        <div></div>
    );
};
