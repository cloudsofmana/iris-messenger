import { useEffect, useMemo, useState } from 'preact/hooks';
import { route } from 'preact-router';

import SimpleImageModal from '@/components/modal/Image.tsx';
import { useProfile } from '@/nostr/hooks/useProfile.ts';
import { getEventReplyingTo, isRepost } from '@/nostr/utils.ts';
import useLocalState from '@/state/useLocalState.ts';
import ProfileHelmet from '@/views/profile/Helmet.tsx';

import Feed from '../../components/feed/Feed.tsx';
import Show from '../../components/helpers/Show.tsx';
import { isSafeOrigin } from '../../components/SafeImg.tsx';
import ProfileCard from '../../components/user/ProfileCard.tsx';
import Key from '../../nostr/Key.ts';
import SocialNetwork from '../../nostr/SocialNetwork.ts';
import { translate as t } from '../../translations/Translation.mjs';
import View from '../View.tsx';

function Profile(props) {
  const [blocked, setBlocked] = useState(false);
  const [hexPub, setHexPub] = useState('');
  const [npub, setNpub] = useState('');
  const [banner, setBanner] = useState('');
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const setIsMyProfile = useLocalState('isMyProfile', false)[1];

  const profile = useProfile(hexPub);

  useEffect(() => {
    if (!hexPub) {
      return;
    }
    const isMyProfile = hexPub === Key.getPubKey();
    setIsMyProfile(isMyProfile);
    SocialNetwork.getBlockedUsers((blockedUsers) => {
      setBlocked(blockedUsers.has(hexPub));
    });
  }, [hexPub]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    let bannerURL;

    try {
      bannerURL = profile.banner && new URL(profile.banner).toString();
      if (!bannerURL) {
        return;
      }

      bannerURL = isSafeOrigin(bannerURL)
        ? bannerURL
        : `https://imgproxy.iris.to/insecure/rs:fit:948:948/plain/${bannerURL}`;

      setBanner(bannerURL);
    } catch (e) {
      console.log('Invalid banner URL', profile.banner);
    }
  }, [profile]);

  useEffect(() => {
    const pub = props.id;
    const npubComputed = Key.toNostrBech32Address(pub, 'npub');

    if (npubComputed && npubComputed !== pub) {
      route(`/${npubComputed}`, true);
      return;
    }

    const hexPubComputed = Key.toNostrHexAddress(pub) || '';

    if (hexPubComputed) {
      setHexPub(hexPubComputed);
      setNpub(Key.toNostrBech32Address(hexPubComputed, 'npub') || '');
    } else {
      let nostrAddress = pub;
      if (!nostrAddress.match(/.+@.+\..+/)) {
        if (nostrAddress.match(/.+\..+/)) {
          nostrAddress = '_@' + nostrAddress;
        } else {
          nostrAddress = nostrAddress + '@iris.to';
        }
      }

      Key.getPubKeyByNip05Address(nostrAddress).then((pubKey) => {
        if (pubKey) {
          const npubComputed = Key.toNostrBech32Address(pubKey, 'npub');
          if (npubComputed && npubComputed !== pubKey) {
            setNpub(npubComputed);
            setHexPub(pubKey);
          }
        } else {
          setNpub(''); // To indicate not found
        }
      });
    }

    setTimeout(() => {
      window.prerenderReady = true;
    }, 1000);
    return () => {
      setIsMyProfile(false);
    };
  }, [props.id]);

  const filterOptions = useMemo(() => {
    return [
      {
        name: t('posts'),
        filter: { authors: [hexPub], kinds: [1, 6], limit: 10 },
        filterFn: (event) => !getEventReplyingTo(event) || isRepost(event),
        eventProps: { showRepliedMsg: true },
      },
      {
        name: t('posts_and_replies'),
        filter: { authors: [hexPub], kinds: [1, 6], limit: 5 },
        eventProps: { showRepliedMsg: true, fullWidth: false },
      },
      {
        name: t('likes'),
        filter: { authors: [hexPub], kinds: [7], limit: 5 },
      },
    ];
  }, [hexPub]);

  if (!hexPub) {
    return <div></div>;
  }

  const title = profile.display_name || profile.name || 'Profile';
  const ogTitle = `${title} | Iris`;
  const description = `Latest posts by ${profile.display_name || profile.name || 'user'}. ${
    profile.about || ''
  }`;

  return (
    <View>
      <Show when={banner && !blocked}>
        <div
          className="mb-4 h-48 bg-cover bg-center cursor-pointer"
          style={{ backgroundImage: `url(${banner})` }}
          onClick={() => setBannerModalOpen(true)}
        ></div>
        <Show when={bannerModalOpen}>
          <SimpleImageModal imageUrl={profile.banner} onClose={() => setBannerModalOpen(false)} />
        </Show>
      </Show>
      <div>
        <ProfileHelmet
          title={title}
          description={description}
          picture={profile.picture}
          ogTitle={ogTitle}
        />
        <ProfileCard npub={npub} hexPub={hexPub} />
        <Show when={!blocked}>
          <Feed key={`posts${hexPub}`} filterOptions={filterOptions} />
        </Show>
      </div>
    </View>
  );
}

export default Profile;
