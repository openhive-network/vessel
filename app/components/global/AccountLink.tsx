import React from 'react';

const AccountLink: React.FC<any> = ({ name, content }) => {
  const handleLink = () => {
    window.electronAPI?.openExternal(`https://hive.blog/@${encodeURIComponent(name)}`);
  };

  return <a onClick={handleLink}>{content}</a>;
};

export default AccountLink;
