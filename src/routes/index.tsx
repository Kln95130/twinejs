import * as React from 'react';
import {BrowserRouter, Route, Switch} from 'react-router-dom';
import {usePrefsContext} from '../store/prefs';
import {AboutTwineRoute} from './about-twine';
import {LocaleSelectRoute} from './locale-select';
import {PassageEditRoute} from './passage-edit';
import {StoryFormatListRoute} from './story-format-list';
import {StoryEditRoute} from './story-edit';
import {StoryImportRoute} from './story-import';
import {StoryJavaScriptRoute} from './story-javascript';
import {StoryListRoute} from './story-list';
import {StoryPlayRoute} from './story-play';
import {StoryProofRoute} from './story-proof';
import {StorySearchRoute} from './story-search';
import {StoryStatsRoute} from './story-stats';
import {StoryTestRoute} from './story-test';
import {StoryStylesheetRoute} from './story-stylesheet';
import {WelcomeRoute} from './welcome';

export const Routes: React.FC = () => {
	const {prefs} = usePrefsContext();

	return (
		<BrowserRouter>
			{prefs.welcomeSeen ? (
				<Switch>
					<Route exact path="/">
						<StoryListRoute />
					</Route>
					<Route path="/about">
						<AboutTwineRoute />
					</Route>
					<Route path="/import/stories">
						<StoryImportRoute />
					</Route>
					<Route path="/locale">
						<LocaleSelectRoute />
					</Route>
					<Route path="/story-formats">
						<StoryFormatListRoute />
					</Route>
					<Route path="/welcome">
						<WelcomeRoute />
					</Route>
					<Route path="/stories/:storyId/javascript">
						<StoryJavaScriptRoute />
					</Route>
					<Route path="/stories/:storyId/passages/:passageId">
						<PassageEditRoute />
					</Route>
					<Route path="/stories/:storyId/play">
						<StoryPlayRoute />
					</Route>
					<Route path="/stories/:storyId/proof">
						<StoryProofRoute />
					</Route>
					<Route path="/stories/:storyId/search">
						<StorySearchRoute />
					</Route>
					<Route path="/stories/:storyId/stats">
						<StoryStatsRoute />
					</Route>
					<Route path="/stories/:storyId/stylesheet">
						<StoryStylesheetRoute />
					</Route>
					<Route path="/stories/:storyId/test/:passageId">
						<StoryTestRoute />
					</Route>
					<Route path="/stories/:storyId/test">
						<StoryTestRoute />
					</Route>
					<Route path="/stories/:storyId">
						<StoryEditRoute />
					</Route>
					<Route
						path="*"
						render={path => {
							console.warn(
								`No route for path "${path.location.pathname}", rendering story list`
							);
							return <StoryListRoute />;
						}}
					></Route>
				</Switch>
			) : (
				<WelcomeRoute />
			)}
		</BrowserRouter>
	);
};