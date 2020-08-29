import Head from "next/head";
import styles from "../styles/Home.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Is Bowie's House 🔥?</h1>
      </main>

      <footer className={styles.footer}>A 20 Keefer Ct. Production</footer>
    </div>
  );
}
