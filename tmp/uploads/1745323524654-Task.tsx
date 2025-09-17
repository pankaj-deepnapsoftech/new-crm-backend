//@ts-nocheck
import React, { useEffect, useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Divider,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  useDisclosure,
  useColorModeValue,
  Select,
  Spinner,
} from "@chakra-ui/react";
import { FaCheck, FaCloudUploadAlt, FaUpload } from "react-icons/fa";
import { MdOutlineRefresh } from "react-icons/md";
import axios, { Axios } from "axios";
import { useCookies } from "react-cookie";
import { toast } from "react-toastify";
import Pagination from "./Pagination";
import { NavLink, useNavigate } from "react-router-dom";
import UploadInvoice from "./UploadInvoice";
import PaymentModal from "./PaymentModal";
import { IoEyeSharp } from "react-icons/io5";
import TokenAmount from "./TokenAmount";

const Task = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [cookies] = useCookies();
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState(null);
  const dropZoneBg = useColorModeValue("gray.100", "gray.700");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState(1);
  const role = cookies?.role;
  const navigate = useNavigate();
  const [saleId, setSaleId] = useState("");
  const [invoiceFile, setInvoiceFile] = useState("");
  const invoiceDisclosure = useDisclosure();
  const [paymentfile, setPaymentFile] = useState("");
  const paymentDisclosure = useDisclosure();
  const [verifystatus, setVerifyStatus] = useState(false);
  const [assignId, setAssignId] = useState();
  const tokenDisclosure = useDisclosure();
  const [tokenAmount, setTokenAmount] = useState();
  const [paymentFor, setPaymentFor] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    date: "",
    manager: "",
    productName: "",
    search: "",
  });

  const fetchTasks = async () => {
    try {
      setIsLoading(true);

      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}assined/get-assined?page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${cookies?.access_token}`,
          },
        }
      );

      const tasks = response.data.data.map((task) => {
        const sale = task?.sale_id?.length ? task.sale_id[0] : null;
        const product = sale?.product_id?.length ? sale.product_id[0] : null;
        const assign = task?.assined_by?.length ? task.assined_by[0] : null;
        const customer = task?.sale_id[0]?.customer_id
          ? task?.sale_id[0]?.customer_id[0]
          : null;
        const user = task?.sale_id[0]?.user_id
          ? task?.sale_id[0]?.user_id[0]
          : null;

        return {
          id: task?._id,
          date: new Date(task.createdAt).toLocaleDateString(),
          productName: product?.name || "No product name",
          productQuantity: sale?.product_qty || 0,
          productPrice: `${sale?.price || 0} /-`,
          assignedBy: assign?.first_name || "Unknown",
          role: assign?.role || "No role",
          design_status: task?.isCompleted || "N/A",
          design_approval: sale?.customer_approve || "Pending",
          customer_design_comment:
            sale?.customer_design_comment || "No comment",
          sale_id: sale?._id || "No sale ID",
          designFile: sale?.designFile || null,
          assinedby_comment: task?.assinedby_comment || "No comment",
          assined_process: task?.assined_process || "No process",
          bom: sale?.bom || [],
          customer_name: customer?.full_name,
          company_name: customer?.company_name,
          sale_by: user?.first_name,
          invoice: sale?.invoice,
          payment_verify: sale?.payment_verify,
          paymet_status: sale?.paymet_status,
          customer_pyement_ss: sale?.customer_pyement_ss,
          token_amt: sale?.token_amt,
          token_status: sale?.token_status,
          token_ss: sale?.token_ss,
          isTokenVerify: sale?.isTokenVerify,
          bom_name: sale?.bom[0]?.bom_name,
        };
      });

      setTasks(tasks);
     
    } catch (error) {
      toast.error(error);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchTasks();
  }, [cookies?.access_token, page]);

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const colorChange = (color) => {
    if (color === "Pending") {
      return "orange";
    } else if (color === "Reject" || color === "Design Rejected") {
      return "red";
    } else if (color === false) {
      return "orange";
    } else {
      return "green";
    }
  };

  const filteredTasks = tasks.filter((task) => {
    return (
      (!filters.status || task.design_status === filters.status) &&
      (!filters.date || task.date === filters.date) &&
      (!filters.search ||
        task.productName.toLowerCase().includes(filters.search.toLowerCase()) ||
        task.assignedBy.toLowerCase().includes(filters.search.toLowerCase()))
    );
  });

  const handleOpenModal = (task) => {
    //console.log(task);

    setSelectedTask(task);
    setFile(null);
    onOpen();
  };

  const handleFileDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setFile(event.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    const fileInput = document.getElementById("file-input");
    fileInput && fileInput.click();
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    // Validate that the file is an image
    const validImageTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validImageTypes.includes(file.type)) {
      alert("Please upload a valid image file (JPG, PNG, GIF).");
      return;
    }

    // Form data for uploading
    const formData = new FormData();
    formData.append("image", file);
    formData.append("assined_to", selectedTask.id);
    formData.append("assinedto_comment", comment);

    try {
      // Upload the image to the backend
      const response = await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}purchase/upload-image/${selectedTask?.sale_id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${cookies?.access_token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("File uploaded successfully.");
      onClose();
      fetchTasks();
    } catch (error) {
      console.error("Error uploading file:", error);

      onClose();
    }
  };

  const handleAccept = async (id) => {
    try {
      const response = await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}assined/update-status/${id}`,
        { isCompleted: "UnderProcessing" },
        {
          headers: {
            Authorization: `Bearer ${cookies?.access_token}`,
          },
        }
      );
      toast.success(response.data.message);
      fetchTasks();
    } catch (error) {
      console.log(error);

      toast.error(error);
    }
  };

  const handleDone = async (id) => {
    try {
      const response = await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}assined/update-status/${id}`,
        { isCompleted: "Completed" },
        {
          headers: {
            Authorization: `Bearer ${cookies?.access_token}`,
          },
        }
      );
      //console.log(response);

      toast.success(response.data.message);
      fetchTasks();
    } catch (error) {
      console.log(error);

      toast.error(error);
    }
  };

  const handleBOM = (id) => {
    //console.log(id);
    navigate("/production/bom", { state: { id } });
  };

  const handleInvoiceUpload = (id: any, file: any) => {
    setSaleId(id);
    setInvoiceFile(file);
    invoiceDisclosure.onOpen();
  };

  const handlePayment = (
    id: any,
    payment: string,
    verify: boolean,
    assignId: any,
    payfor:string
  ) => {
    setSaleId(id);
    setPaymentFile(payment);
    setVerifyStatus(verify);
    setAssignId(assignId);
    setPaymentFor(payfor);
    paymentDisclosure.onOpen();
  };

  const handleTokenClick = (id: any, amount: number) => {
    setSaleId(id);
    setTokenAmount(amount);
    tokenDisclosure.onOpen();
  };

  return (
    <div className="overflow-x-hidden">
      <HStack className="flex justify-between items-center mb-5 mt-5">
        <Text className="text-lg font-bold">Tasks</Text>
        <HStack className="space-x-2">
          <Button
            fontSize={{ base: "14px", md: "14px" }}
            paddingX={{ base: "10px", md: "12px" }}
            paddingY={{ base: "0", md: "3px" }}
            width={{ base: "full", md: 100 }}
            onClick={fetchTasks}
            leftIcon={<MdOutlineRefresh />}
            color="#1640d6"
            borderColor="#1640d6"
            variant="outline"
          >
            Refresh
          </Button>
        </HStack>
      </HStack>

      <HStack spacing={4} mb={5} mt={5} flexWrap="wrap" align="start" gap={4}>
        <FormControl w={{ base: "100%", md: "30%" }}>
          <FormLabel>Status</FormLabel>
          <Select
            placeholder="Select Status"
            fontSize="sm"
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </Select>
        </FormControl>

        <FormControl w={{ base: "100%", md: "30%" }}>
          <FormLabel>Date</FormLabel>
          <Input
            type="date"
            fontSize="sm"
            onChange={(e) => handleFilterChange("date", e.target.value)}
          />
        </FormControl>

        <FormControl w={{ base: "100%", md: "30%" }}>
          <FormLabel>Search</FormLabel>
          <Input
            placeholder="Search by Product or Manager"
            fontSize="sm"
            onChange={(e) => handleFilterChange("search", e.target.value)}
          />
        </FormControl>
      </HStack>

      {isLoading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="300px"
        >
          <Spinner size="xl" />
        </Box>
      ) : (
        <VStack spacing={5}>
          {tasks.map((task) => (
            <Box
              key={task._id}
              borderWidth="1px"
              borderRadius="lg"
              boxShadow="lg"
              bg="white"
              p={4}
              w="100%"
              position="relative"
            >
              {/* Left colored bar */}
              <Box
                position="absolute"
                top={0}
                left={0}
                h="100%"
                w={2}
                bg={colorChange(task.design_status)}
                borderRadius="md"
              />

              <HStack
                justify="space-between"
                mb={3}
                flexWrap="wrap"
                align="start"
              >
                <Text fontWeight="bold" fontSize="lg">
                  {task?.productName}
                </Text>

                <VStack align="start">
                  <Badge
                    colorScheme={colorChange(task.design_status)}
                    fontSize="sm"
                  >
                    <strong>Task:</strong> {task?.design_status}
                  </Badge>

                  {["acc", "account", "accountant", "dispatch", "dis"].includes(
                    role.toLowerCase()
                  ) &&
                  task?.token_amt &&
                  task?.token_status === false ? (
                    <Badge colorScheme="orange" fontSize="sm">
                      Token Amount : Pending
                    </Badge>
                  ) : null}

                  {["acc", "account", "accountant", "dispatch", "dis"].includes(
                    role.toLowerCase()
                  ) &&
                  task?.token_amt &&
                  task?.token_status ? (
                    <Badge colorScheme="green" fontSize="sm">
                      Token Amount : Paid
                    </Badge>
                  ) : null}

                  {["acc", "account", "accountant", "dispatch", "dis"].includes(
                    role.toLowerCase()
                  ) && task?.isTokenVerify === false? (
                    <Badge colorScheme="orange" fontSize="sm">
                      Token Verification :{" "}
                     Pending
                    </Badge>
                  ) : null}

                  {["acc", "account", "accountant", "dispatch", "dis"].includes(
                    role.toLowerCase()
                  ) && task?.isTokenVerify ? (
                    <Badge colorScheme="green" fontSize="sm">
                      Token Verification :{" "}
                      Verified
                    </Badge>
                  ) : null}

                  {["acc", "account", "accountant", "dispatch", "dis"].includes(
                    role.toLowerCase()
                  ) && task?.paymet_status ? (
                    <Badge
                      colorScheme={colorChange(task?.paymet_status)}
                      fontSize="sm"
                    >
                      <strong>Payment:</strong>{" "}
                      {task?.paymet_status === "Paied"
                        ? "Paid"
                        : task?.paymet_status}
                    </Badge>
                  ) : null}

                  {["acc", "account", "accountant", "dispatch", "dis"].includes(
                    role.toLowerCase()
                  ) && task?.payment_verify ? (
                    <Badge
                      colorScheme={colorChange(task.payment_verify)}
                      fontSize="sm"
                    >
                      <strong>Payment Verification:</strong>{" "}
                      {task?.payment_verify ? "Verified" : "Not Verfied"}
                    </Badge>
                  ) : null}
                </VStack>
              </HStack>

              {/* Divider */}
              <Divider />

              <HStack
                justify="space-between"
                spacing={3}
                mt={3}
                flexWrap="wrap"
                align="start"
                gap={4}
              >
                <VStack align="start" w={{ base: "100%", md: "48%" }}>
                  <Text fontSize="sm">
                    <strong>Product Price:</strong> {task.productPrice}
                  </Text>
                  <Text fontSize="sm">
                    <strong>Quantity:</strong> {task.productQuantity}
                  </Text>
                  {["acc", "account", "accountant", "dispatch", "dis"].includes(
                    role.toLowerCase()
                  ) ? (
                    <>
                      <Text fontSize="sm">
                        <strong>Customer:</strong> {task.customer_name}
                      </Text>
                      <Text fontSize="sm">
                        <strong>Sale By:</strong> {task.sale_by}
                      </Text>
                      <Text fontSize="sm">
                    <strong>Assigned By:</strong> {task.assignedBy}
                  </Text>
                    </>
                  ) : null}
                </VStack>
                <VStack
                  align={{ base: "start", md: "end" }}
                  w={{ base: "100%", md: "48%" }}
                >                 
                  <Text fontSize="sm">
                    <strong>Assigned Process:</strong> {task?.assined_process}
                  </Text>
                  {task?.assinedby_comment ? (
                    <Text fontSize="sm" >
                      <strong>Remarks:</strong> {task?.assinedby_comment}
                    </Text>
                  
                  ) : null}

                  {task?.bom_name ? (
                    <Text fontSize="sm" color="blue">
                    <strong className="text-black">BOM Name:</strong> {task?.bom_name}
                  </Text>
                  ) : null}

                  {task?.token_ss ? (
                    <Text                     
                      className="text-blue-500 underline text-sm cursor-pointer"
                      onClick={() =>
                        handlePayment(
                          task?.sale_id,
                          task?.token_ss,
                          task?.isTokenVerify,                       
                          task?.id,
                          "token"
                        )
                      }
                    >
                      {" "}
                      View Token Proof{" "}
                    </Text>
                  ) : null}
                </VStack>
              </HStack>

              {/* Footer */}
              <Divider my={3} />
              {role.toLowerCase().includes("prod") ? (
                <HStack className="space-x-3">
                  {task?.design_status === "Pending" ? (
                    <Button
                      colorScheme="teal"
                      size="sm"
                      onClick={() => handleAccept(task?.id)}
                    >
                      Accept Task
                    </Button>
                  ) : null}

                  {task?.design_status === "UnderProcessing" ? (
                    <>
                      {task?.bom.length > 0 ? (
                        <Badge colorScheme="green" fontSize="sm">
                          <strong>BOM:</strong> Created
                        </Badge>
                      ) : (
                        <Button
                          colorScheme="teal"
                          size="sm"
                          onClick={() => handleBOM(task?.sale_id)}
                        >
                          Create BOM
                        </Button>
                      )}

                      {task?.design_status != "Completed" ? (
                        <Button
                          colorScheme="orange"
                          leftIcon={<FaCheck />}
                          size="sm"
                          onClick={() => handleDone(task?.id)}
                        >
                          Task Done
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </HStack>
              ) : ["accountant", "acc"].includes(role.toLowerCase()) ? (
                <HStack
                  justify="space-between"
                  mt={3}
                  flexWrap="wrap"
                  align="center"
                  gap={4}
                >
                  {task?.design_status === "Pending" ? (
                    <Button
                      colorScheme="teal"
                      size="sm"
                      onClick={() => handleAccept(task?.id)}
                    >
                      Accept Task
                    </Button>
                  ) : null}

                  {task?.design_approval === "Approve" ? (
                    <Button
                      bgColor="white"
                      _hover={{ bgColor: "purple.500" }}
                      className="border border-purple-500 hover:text-white"
                      w={{ base: "100%", md: "auto" }}
                      onClick={() =>
                        handleTokenClick(task?.sale_id, task?.token_amt)
                      }
                    >
                      Add Token Amount{" "}
                    </Button>
                  ) : null}

                  {task?.isTokenVerify ? (
                    <Button
                      bgColor="white"
                      leftIcon={<FaCloudUploadAlt />}
                      _hover={{ bgColor: "blue.500" }}
                      className="border border-blue-500 hover:text-white"
                      onClick={() =>
                        handleInvoiceUpload(task?.sale_id, task?.invoice)
                      }
                      width={{ base: "full", sm: "auto" }}
                    >
                      Upload Invoice
                    </Button>
                  ) : null}

                  {task?.customer_pyement_ss ? (
                    <Button
                      bgColor="white"
                      leftIcon={<IoEyeSharp />}
                      _hover={{ bgColor: "orange.500" }}
                      className="border border-orange-500 hover:text-white"
                      onClick={() =>
                        handlePayment(
                          task?.sale_id,
                          task?.customer_pyement_ss,
                          task?.payment_verify,
                          task?.id,
                          "payment"
                        )
                      }
                      width={{ base: "full", sm: "auto" }}
                    >
                      View Payment
                    </Button>
                  ) : null}

                  <Text fontSize="sm">
                    <strong>Date:</strong> {task.date}
                  </Text>
                </HStack>
              ) : (
                <HStack
                  justify="space-between"
                  mt={3}
                  flexWrap="wrap"
                  align="center"
                  gap={4}
                >
                  <VStack align="start">
                    {task?.design_status === "Pending" ? (
                      <Button
                        leftIcon={<FaCheck />}
                        colorScheme="teal"
                        size="sm"
                        onClick={() => handleAccept(task?.id)}
                      >
                        Accept Task
                      </Button>
                    ) : task?.design_status === "UnderProcessing" ? (
                      <Button
                        leftIcon={<FaUpload />}
                        colorScheme="teal"
                        size="sm"
                        onClick={() => handleOpenModal(task)}
                      >
                        Upload File
                      </Button>
                    ) : task?.design_approval === "Approve" ? (
                      <Badge colorScheme="green" fontSize="sm">
                        Customer Approval: {task?.design_approval}
                      </Badge>
                    ) : task?.design_approval === "Reject" ? (
                      <VStack align="start">
                        <Badge colorScheme="red" fontSize="sm">
                          Customer Approval: {task?.design_approval}
                        </Badge>
                        <Text className="text-red-500">
                          Feedback: {task?.customer_design_comment}
                        </Text>
                        <Button
                          leftIcon={<FaUpload />}
                          colorScheme="teal"
                          size="sm"
                          onClick={() => handleOpenModal(task)}
                        >
                          Re-Upload File
                        </Button>
                      </VStack>
                    ) : null}

                    {task?.designFile ? (
                      <Text fontSize="sm">
                        <strong>Uploaded File:</strong>{" "}
                        <a
                          href={task.designFile}
                          className="text-blue-500 underline"
                          target="_blank"
                        >
                          preview
                        </a>
                      </Text>
                    ) : null}
                  </VStack>

                  <Text fontSize="sm">
                    <strong>Date:</strong> {task.date}
                  </Text>
                </HStack>
              )}
            </Box>
          ))}
        </VStack>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload File</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Task</FormLabel>
                <Text fontWeight="bold">{selectedTask?.productName}</Text>
              </FormControl>
              <FormControl>
                <FormLabel>Upload File</FormLabel>
                <Box
                  p={4}
                  borderWidth="2px"
                  borderColor={file ? "teal.500" : "gray.300"}
                  borderRadius="md"
                  bg={dropZoneBg}
                  textAlign="center"
                  onDrop={handleFileDrop}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={(event) => event.preventDefault()}
                  onClick={triggerFileInput}
                  cursor="pointer"
                >
                  {file ? (
                    <Text fontSize="sm" color="teal.500">
                      {file.name}
                    </Text>
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      Drag and drop a file here, or{" "}
                      <Text as="span" color="blue.500" cursor="pointer">
                        browse
                      </Text>
                    </Text>
                  )}
                </Box>
                <Input
                  type="file"
                  id="file-input"
                  display="none"
                  onChange={(event) =>
                    setFile(event.target.files ? event.target.files[0] : null)
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Remarks:</FormLabel>
                <Input
                  type="text"
                  id="assinedto_comment"
                  placeholder="Add Details (if any)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={handleFileUpload}
              isDisabled={!file}
            >
              Upload
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal for invoice upload, payment and dispatch */}
      <Modal
        isOpen={invoiceDisclosure.isOpen}
        onClose={invoiceDisclosure.onClose}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload Invoice</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <UploadInvoice
              sale_id={saleId}
              invoicefile={invoiceFile}
              onClose={invoiceDisclosure.onClose}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              bgColor="white"
              _hover={{ bgColor: "red.500" }}
              className="border border-red-500 hover:text-white w-full ml-2"
              mr={3}
              onClick={() => invoiceDisclosure.onClose()}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal for  payment */}
      <Modal
        isOpen={paymentDisclosure.isOpen}
        onClose={paymentDisclosure.onClose}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Payment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <PaymentModal
              sale_id={saleId}
              payment={paymentfile}
              verify={verifystatus}
              assign={assignId}
              payfor= {paymentFor}
              onClose={paymentDisclosure.onClose}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              bgColor="white"
              _hover={{ bgColor: "red.500" }}
              className="border border-red-500 hover:text-white w-full ml-2"
              mr={3}
              onClick={() => paymentDisclosure.onClose()}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* token modal */}
      <Modal isOpen={tokenDisclosure.isOpen} onClose={tokenDisclosure.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader> Sample Token Amount</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <TokenAmount
              sale={saleId}
              onClose={tokenDisclosure.onClose}
              refresh={fetchTasks}
              tokenAmount={tokenAmount}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              bgColor="white"
              _hover={{ bgColor: "red.500" }}
              className="border border-red-500 hover:text-white w-full ml-2"
              onClick={tokenDisclosure.onClose}
            >
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Pagination page={page} setPage={setPage} length={tasks?.length} />
    </div>
  );
};

export default Task;
