import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers, utils } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { Formik } from 'formik';

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }

        
    }

    const listenGreeting = async () =>  {
        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()

        const GREETER_ABI = ["event NewGreeting(bytes32 greeting)"]
        const contract = new Contract(
            '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
            GREETER_ABI,
            signer
        )
        contract.on("NewGreeting", (greeting: string) => {
            console.log('NewGreeting');
            console.log(utils.parseBytes32String(greeting))
        })
    }
    React.useEffect(() => {listenGreeting()}, [])

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div>

                    <Formik
                        initialValues={{ day: '', month: '' }}
                        validate={values => {
                            const errors = {};

                            const dayInt = parseInt(values.day)
                            if (isNaN(dayInt) || dayInt < 1 || dayInt > 31) {
                                errors.day = 'wrong';
                            }

                            const monthInt = parseInt(values.month)
                            if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
                                errors.month = 'wrong';
                            }

                            return errors;
                        }}
                        onSubmit={(values, { setSubmitting }) => {
                            console.log(values)
                            // setTimeout(() => {
                            //     alert(JSON.stringify(values, null, 2));
                            //     setSubmitting(false);
                            // }, 400);
                        }}
                    >
                        {({
                            values,
                            errors,
                            touched,
                            handleChange,
                            handleBlur,
                            handleSubmit,
                            isSubmitting,
                            /* and other goodies */
                        }) => (
                            <form onSubmit={handleSubmit}>
                                {'day'}
                                <input
                                    type="number"
                                    name="day"
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    value={values.day}
                                />
                                {errors.day && touched.day && errors.day}
                                {'month'}
                                <input
                                    type="number"
                                    name="month"
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    value={values.month}
                                />
                                {errors.month && touched.month && errors.month}
                                <button type="submit" disabled={isSubmitting}>
                                    Submit
                                </button>
                            </form>
                        )}
                    </Formik>
                </div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>


            </main>
        </div>
    )
}
