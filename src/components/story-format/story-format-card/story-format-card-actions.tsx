import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconCheck, IconTrash} from '@tabler/icons';
import {ButtonBar} from '../../container/button-bar';
import {IconButton} from '../../control/icon-button';
import {StoryFormat} from '../../../store/story-formats';

export interface StoryFormatCardActionsProps {
	format: StoryFormat;
	onSelect: () => void;
	selected: boolean;
	selectedText?: string;
	selectIcon?: string;
	selectLabel?: string;
}

export const StoryFormatCardActions: React.FC<StoryFormatCardActionsProps> = props => {
	const {format, onSelect, selected, selectIcon, selectLabel} = props;
	const {t} = useTranslation();

	if (selected && !format.userAdded) {
		return null;
	}

	return (
		<ButtonBar>
			{format.userAdded && (
				<IconButton
					icon={<IconTrash />}
					label={t('common.delete')}
					variant="danger"
				/>
			)}
			{!selected && format.loadState === 'loaded' && (
				<IconButton
					icon={selectIcon ?? <IconCheck />}
					label={
						selectLabel ?? format.properties.proofing
							? t('components.storyFormatCard.useProofingFormat')
							: t('components.storyFormatCard.useFormat')
					}
					onClick={onSelect}
					variant="primary"
				/>
			)}
		</ButtonBar>
	);
};