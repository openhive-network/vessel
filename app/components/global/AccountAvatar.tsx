import React from 'react';

const AccountAvatar: React.FC<any> = ({ name }) => {
  const handleLink = () => {
    window.electronAPI?.openExternal(`https://hive.blog/@${encodeURIComponent(name)}`);
  };

  return (
    <a
      onClick={handleLink}
      style={{
        backgroundImage: `url(https://steemitimages.com/u/${name || 'steemit'}/avatar/medium)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'inline-block',
        height: '96px',
        width: '96px',
      }}
    />
  );
};

export default AccountAvatar;
