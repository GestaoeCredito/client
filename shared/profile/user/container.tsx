import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../../constants/tracker2'
import {getShowAirdropBanner} from '../../constants/wallets'
import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as SearchGen from '../../actions/search-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/tracker2'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Profile2 from '.'
import {memoize} from '../../util/memoize'
import ProfileSearch from '../search/bar'
import flags from '../../util/feature-flags'

type OwnProps = Container.RouteProps<{username: string}>

const headerBackgroundColorType = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return 'red'
  } else if (state === 'notAUserYet') {
    return 'blue'
  } else {
    return followThem ? 'green' : 'blue'
  }
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const username = Container.getRouteProps(ownProps, 'username', '')
  const d = Constants.getDetails(state, username)
  const notAUser = d.state === 'notAUserYet'
  const userIsYou = username === state.config.username
  const showAirdropBanner = getShowAirdropBanner(state)

  const commonProps = {
    _assertions: null,
    _suggestionKeys: null,
    followThem: false,
    followers: I.OrderedSet<string>(),
    followersCount: 0,
    following: I.OrderedSet<string>(),
    followingCount: 0,
    fullName: '',
    guiID: d.guiID,
    name: '',
    reason: d.reason,
    service: '',
    showAirdropBanner,
    state: d.state,
    userIsYou,
    username,
    youAreInAirdrop: false,
  }

  if (!notAUser) {
    // Keybase user
    const followThem = Constants.followThem(state, username)
    const followersCount = state.tracker2.usernameToDetails.getIn([username, 'followersCount'])
    const followingCount = state.tracker2.usernameToDetails.getIn([username, 'followingCount'])

    return {
      ...commonProps,
      _assertions: d.assertions,
      _suggestionKeys: userIsYou ? state.tracker2.proofSuggestions : null,
      backgroundColorType: headerBackgroundColorType(d.state, followThem),
      followThem,
      followers: state.tracker2.usernameToDetails.getIn([username, 'followers']),
      followersCount,
      following: state.tracker2.usernameToDetails.getIn([username, 'following']),
      followingCount,
      reason: d.reason,
      title: username,
    }
  } else {
    // SBS profile. But `nonUserDetails` might not have arrived yet,
    // make sure the screen does not appear broken until then.
    const nonUserDetails = Constants.getNonUserDetails(state, username)
    const name = nonUserDetails.assertionValue || username
    const service = nonUserDetails.assertionKey
    // For SBS profiles, display service username as the "big username". Some
    // profiles will have a special formatting for the name, e.g. phone numbers
    // will be formatted.
    let title = nonUserDetails.formattedName || name

    return {
      ...commonProps,
      backgroundColorType: headerBackgroundColorType(d.state, false),
      fullName: nonUserDetails.fullName,
      name,
      service,
      title,
    }
  }
}
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onEditAvatar: () => dispatch(ProfileGen.createEditAvatar()),
  _onReload: (username: string, isYou: boolean, state: Types.DetailsState) => {
    if (state !== 'valid') {
      // Might be a Keybase user or not, launch non-user profile fetch.
      dispatch(Tracker2Gen.createLoadNonUserProfile({assertion: username}))
    }
    if (state !== 'notAUserYet') {
      dispatch(Tracker2Gen.createShowUser({asTracker: false, skipNav: true, username}))

      if (isYou) {
        dispatch(Tracker2Gen.createGetProofSuggestions())
      }
    }
  },
  onAddIdentity: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileProofsList']})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSearch: () => {
    dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'}))
  },
})

const followToArray = memoize((followers, following) => ({
  followers: followers ? followers.toArray() : null,
  following: following ? following.toArray() : null,
}))

const connected = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    let onAddIdentity: (() => void) | null = null
    if (
      stateProps.userIsYou &&
      flags.proofProviders &&
      stateProps._suggestionKeys &&
      stateProps._suggestionKeys.some(s => s.belowFold)
    ) {
      onAddIdentity = dispatchProps.onAddIdentity
    }

    const notAUser = stateProps.state === 'notAUserYet'
    let assertionKeys =
      notAUser && !!stateProps.service
        ? [stateProps.username]
        : stateProps._assertions
        ? stateProps._assertions
            .sort((a, b) => a.priority - b.priority)
            .keySeq()
            .toArray()
        : null

    // For 'phone' or 'email' profiles do not display placeholder assertions.
    const service = stateProps.service
    const impTofu = notAUser && (service === 'phone' || service === 'email')
    if (impTofu) {
      assertionKeys = []
    }

    return {
      assertionKeys,
      backgroundColorType: stateProps.backgroundColorType,
      followThem: stateProps.followThem,
      followersCount: stateProps.followersCount,
      followingCount: stateProps.followingCount,
      fullName: stateProps.fullName,
      name: stateProps.name,
      notAUser,
      onAddIdentity,
      onBack: dispatchProps.onBack,
      onEditAvatar: stateProps.userIsYou ? dispatchProps._onEditAvatar : null,
      onReload: () => dispatchProps._onReload(stateProps.username, stateProps.userIsYou, stateProps.state),
      onSearch: dispatchProps.onSearch,
      reason: stateProps.reason,
      service: stateProps.service,
      showAirdropBanner: stateProps.showAirdropBanner,
      state: stateProps.state,
      suggestionKeys: stateProps._suggestionKeys
        ? stateProps._suggestionKeys
            .filter(s => !s.belowFold)
            .map(s => s.assertionKey)
            .toArray()
        : null,
      title: stateProps.title,
      userIsYou: stateProps.userIsYou,
      username: stateProps.username,
      youAreInAirdrop: stateProps.youAreInAirdrop,
      ...followToArray(stateProps.followers, stateProps.following),
    }
  },
  'Profile2'
)(Profile2)

const Header = ({onSearch}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true}>
    <ProfileSearch whiteText={true} onSearch={onSearch} />
  </Kb.Box2>
)
const ConnectedHeader = Container.connect(
  () => ({}),
  dispatch => ({
    onSearch: () => dispatch(SearchGen.createSearchSuggestions({searchKey: 'profileSearch'})),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Header)

// @ts-ignore let's fix this
connected.navigationOptions = p => ({
  header: undefined,
  headerBackIconColor: Styles.globalColors.white,
  headerHideBorder: false,
  headerStyle: {
    backgroundColor: Styles.globalColors.transparent,
    borderBottomColor: Styles.globalColors.transparent,
    borderBottomWidth: 1,
    borderStyle: 'solid',
  },
  headerTintColor: Styles.globalColors.white,
  headerTitle: ConnectedHeader,
  headerTitleContainerStyle: {
    left: 60,
    right: 20,
  },
  headerTransparent: true,
  underNotch: true,
})

export default connected
