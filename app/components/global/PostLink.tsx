import React from 'react';

const PostLink: React.FC<any> = ({ author, permlink }) => {
  const handleLink = () => {
    window.electronAPI?.openExternal(
      `https://hive.blog/category/@${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`
    );
  };

  return (
    <a onClick={handleLink}>
      {author}/{permlink}
    </a>
  );
};

export default PostLink;
